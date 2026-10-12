import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.api.internal.access import CurrentInternalUser
from app.database import DBSession
from app.exceptions import ResourceNotFoundException
from app.models import (
    AIUsage,
    Organization,
    OrganizationMembership,
    Team,
    User,
    WeeklyPlan,
)
from app.schemas import Model

router = APIRouter()


class OrganizationSummary(Model):
    id: uuid.UUID
    name: str
    slug: str
    suspended_at: datetime | None
    member_count: int
    team_count: int
    plan_count: int
    last_active_at: datetime | None


class UserSearchItem(Model):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    is_active: bool
    is_admin: bool
    organizations: list[str]


class AIUsageSummary(Model):
    organization_id: uuid.UUID
    organization_name: str
    calls: int
    successes: int
    failures: int
    rate_limited: int


async def organization_summary(session: DBSession, org: Organization) -> OrganizationSummary:
    members = await session.scalar(select(func.count()).select_from(OrganizationMembership)
        .where(OrganizationMembership.organization_id == org.id,
               OrganizationMembership.revoked_at.is_(None))) or 0
    teams = await session.scalar(select(func.count()).select_from(Team)
        .where(Team.organization_id == org.id)) or 0
    plans = await session.scalar(select(func.count()).select_from(WeeklyPlan)
        .where(WeeklyPlan.organization_id == org.id)) or 0
    last_plan = await session.scalar(select(func.max(func.coalesce(WeeklyPlan.updated_at, WeeklyPlan.created_at)))
        .where(WeeklyPlan.organization_id == org.id))
    last_usage = await session.scalar(select(func.max(AIUsage.created_at))
        .where(AIUsage.organization_id == org.id))
    last_active = max((x for x in (last_plan, last_usage) if x is not None), default=None)
    return OrganizationSummary(id=org.id, name=org.name, slug=org.slug,
        suspended_at=org.suspended_at, member_count=members, team_count=teams,
        plan_count=plans, last_active_at=last_active)


@router.get("/organizations", tags=["organizations"])
async def list_organizations(staff: CurrentInternalUser, session: DBSession) -> list[OrganizationSummary]:
    orgs = (await session.scalars(select(Organization).order_by(Organization.name))).all()
    return [await organization_summary(session, org) for org in orgs]


@router.post("/organizations/{organization_id}/suspend", tags=["organizations"])
async def suspend_organization(organization_id: uuid.UUID, staff: CurrentInternalUser,
                               session: DBSession) -> OrganizationSummary:
    org = await session.get(Organization, organization_id)
    if org is None:
        raise ResourceNotFoundException("Organization not found")
    org.suspended_at = datetime.now(UTC)
    await session.commit()
    return await organization_summary(session, org)


@router.post("/organizations/{organization_id}/reinstate", tags=["organizations"])
async def reinstate_organization(organization_id: uuid.UUID, staff: CurrentInternalUser,
                                 session: DBSession) -> OrganizationSummary:
    org = await session.get(Organization, organization_id)
    if org is None:
        raise ResourceNotFoundException("Organization not found")
    org.suspended_at = None
    await session.commit()
    return await organization_summary(session, org)


@router.get("/users/search", tags=["users"])
async def search_users(staff: CurrentInternalUser, session: DBSession,
                       q: str = Query("", max_length=120), limit: int = Query(50, ge=1, le=100)) -> list[UserSearchItem]:
    stmt = select(User).order_by(User.email).limit(limit)
    if q:
        stmt = stmt.where(
            User.email.ilike(f"%{q}%")
            | User.first_name.ilike(f"%{q}%")
            | User.last_name.ilike(f"%{q}%")
        )
    users = (await session.scalars(stmt)).all()
    result = []
    for user in users:
        orgs = (await session.scalars(select(Organization.name)
            .join(OrganizationMembership, OrganizationMembership.organization_id == Organization.id)
            .where(OrganizationMembership.user_id == user.id,
                   OrganizationMembership.revoked_at.is_(None)))).all()
        result.append(UserSearchItem(id=user.id, email=user.email, first_name=user.first_name,
            last_name=user.last_name, is_active=user.is_active, is_admin=user.is_admin,
            organizations=list(orgs)))
    return result


@router.post("/users/{user_id}/deactivate", tags=["users"])
async def deactivate_user(user_id: uuid.UUID, staff: CurrentInternalUser,
                          session: DBSession) -> UserSearchItem:
    user = await session.get(User, user_id)
    if user is None or user.id == staff.id:
        raise ResourceNotFoundException("User not found")
    user.is_active = False
    await session.commit()
    orgs = (await session.scalars(select(Organization.name)
        .join(OrganizationMembership, OrganizationMembership.organization_id == Organization.id)
        .where(OrganizationMembership.user_id == user.id,
               OrganizationMembership.revoked_at.is_(None)))).all()
    return UserSearchItem(id=user.id, email=user.email, first_name=user.first_name,
        last_name=user.last_name, is_active=False, is_admin=user.is_admin, organizations=list(orgs))


@router.get("/ai-usage", tags=["ai_usage"])
async def ai_usage(staff: CurrentInternalUser, session: DBSession) -> list[AIUsageSummary]:
    orgs = (await session.scalars(select(Organization).order_by(Organization.name))).all()
    result = []
    for org in orgs:
        rows = (await session.scalars(select(AIUsage.outcome).where(AIUsage.organization_id == org.id))).all()
        result.append(AIUsageSummary(organization_id=org.id, organization_name=org.name,
            calls=len(rows), successes=rows.count("success"),
            failures=sum(x in ("failure", "timeout", "unavailable", "invalid_output") for x in rows),
            rate_limited=rows.count("rate_limited")))
    return result
