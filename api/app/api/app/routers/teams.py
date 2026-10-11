import uuid

from fastapi import APIRouter, status
from pydantic import Field
from sqlalchemy import select, update

from app.api.app.tenant import CurrentMembership, require_org_admin
from app.database import DBSession
from app.exceptions import (
    ConflictException,
    ResourceNotFoundException,
)
from app.models import OrganizationMembership, Team, TeamMembership, User
from app.schemas import Model

router = APIRouter()


class TeamRequest(Model):
    name: str = Field(min_length=2, max_length=120)


class TeamResponse(Model):
    id: uuid.UUID
    name: str
    member_count: int
    lead_member_id: uuid.UUID | None


class TeamMemberRequest(Model):
    member_id: uuid.UUID
    is_primary: bool = False


class TeamMemberResponse(Model):
    member_id: uuid.UUID
    user_id: uuid.UUID
    name: str
    is_lead: bool
    is_primary: bool


async def scoped_team(session: DBSession, org_id: uuid.UUID, team_id: uuid.UUID) -> Team:
    team = await session.scalar(select(Team).where(Team.id == team_id, Team.organization_id == org_id))
    if team is None:
        raise ResourceNotFoundException("Team not found")
    return team


@router.get("/organizations/{organization_id}/teams", tags=["teams"])
async def list_teams(organization_id: uuid.UUID, membership: CurrentMembership, session: DBSession) -> list[TeamResponse]:
    teams = (await session.scalars(select(Team).where(Team.organization_id == organization_id).order_by(Team.name))).all()
    result = []
    for team in teams:
        members = (await session.scalars(select(TeamMembership).where(
            TeamMembership.organization_id == organization_id, TeamMembership.team_id == team.id))).all()
        lead = next((m.membership_id for m in members if m.is_lead), None)
        result.append(TeamResponse(id=team.id, name=team.name, member_count=len(members), lead_member_id=lead))
    return result


@router.post("/organizations/{organization_id}/teams", status_code=status.HTTP_201_CREATED, tags=["teams"])
async def create_team(organization_id: uuid.UUID, data: TeamRequest, membership: CurrentMembership, session: DBSession) -> TeamResponse:
    require_org_admin(membership)
    if await session.scalar(select(Team.id).where(Team.organization_id == organization_id, Team.name == data.name)):
        raise ConflictException("Team name already exists", "name")
    team = Team(organization_id=organization_id, name=data.name)
    session.add(team)
    await session.flush()
    await session.commit()
    return TeamResponse(id=team.id, name=team.name, member_count=0, lead_member_id=None)


@router.patch("/organizations/{organization_id}/teams/{team_id}", tags=["teams"])
async def update_team(organization_id: uuid.UUID, team_id: uuid.UUID, data: TeamRequest,
                      membership: CurrentMembership, session: DBSession) -> TeamResponse:
    require_org_admin(membership)
    team = await scoped_team(session, organization_id, team_id)
    team.name = data.name
    await session.commit()
    members = (await session.scalars(select(TeamMembership).where(TeamMembership.team_id == team_id))).all()
    return TeamResponse(id=team.id, name=team.name, member_count=len(members),
                        lead_member_id=next((m.membership_id for m in members if m.is_lead), None))


@router.get("/organizations/{organization_id}/teams/{team_id}/members", tags=["teams"])
async def list_team_members(organization_id: uuid.UUID, team_id: uuid.UUID,
                            membership: CurrentMembership, session: DBSession) -> list[TeamMemberResponse]:
    await scoped_team(session, organization_id, team_id)
    rows = (await session.execute(select(TeamMembership, OrganizationMembership, User)
        .join(OrganizationMembership, OrganizationMembership.id == TeamMembership.membership_id)
        .join(User, User.id == OrganizationMembership.user_id)
        .where(TeamMembership.organization_id == organization_id, TeamMembership.team_id == team_id)
        .order_by(User.first_name, User.last_name))).all()
    return [TeamMemberResponse(member_id=m.id, user_id=u.id, name=f"{u.first_name} {u.last_name}",
        is_lead=tm.is_lead, is_primary=tm.is_primary) for tm, m, u in rows]


@router.post("/organizations/{organization_id}/teams/{team_id}/members", status_code=201, tags=["teams"])
async def add_team_member(organization_id: uuid.UUID, team_id: uuid.UUID, data: TeamMemberRequest,
                          membership: CurrentMembership, session: DBSession) -> TeamMemberResponse:
    require_org_admin(membership)
    await scoped_team(session, organization_id, team_id)
    target = await session.scalar(select(OrganizationMembership).where(
        OrganizationMembership.id == data.member_id, OrganizationMembership.organization_id == organization_id,
        OrganizationMembership.revoked_at.is_(None)))
    if target is None:
        raise ResourceNotFoundException("Member not found")
    if await session.scalar(select(TeamMembership.id).where(
        TeamMembership.team_id == team_id, TeamMembership.membership_id == data.member_id)):
        raise ConflictException("Member already belongs to this team")
    if data.is_primary:
        await session.execute(update(TeamMembership).where(
            TeamMembership.membership_id == data.member_id,
            TeamMembership.organization_id == organization_id).values(is_primary=False))
    tm = TeamMembership(organization_id=organization_id, team_id=team_id,
                        membership_id=data.member_id, is_primary=data.is_primary, is_lead=False)
    session.add(tm)
    await session.flush()
    user = await session.get(User, target.user_id)
    assert user is not None
    await session.commit()
    return TeamMemberResponse(member_id=target.id, user_id=user.id,
        name=f"{user.first_name} {user.last_name}", is_lead=False, is_primary=tm.is_primary)


@router.put("/organizations/{organization_id}/teams/{team_id}/lead/{member_id}", tags=["teams"])
async def set_team_lead(organization_id: uuid.UUID, team_id: uuid.UUID, member_id: uuid.UUID,
                        membership: CurrentMembership, session: DBSession) -> TeamResponse:
    require_org_admin(membership)
    team = await scoped_team(session, organization_id, team_id)
    target = await session.scalar(select(TeamMembership).where(
        TeamMembership.organization_id == organization_id,
        TeamMembership.team_id == team_id, TeamMembership.membership_id == member_id))
    if target is None:
        raise ResourceNotFoundException("Team member not found")
    await session.execute(update(TeamMembership).where(TeamMembership.team_id == team_id).values(is_lead=False))
    target.is_lead = True
    await session.commit()
    count = len((await session.scalars(select(TeamMembership.id).where(TeamMembership.team_id == team_id))).all())
    return TeamResponse(id=team.id, name=team.name, member_count=count, lead_member_id=member_id)


@router.put("/organizations/{organization_id}/teams/{team_id}/primary/{member_id}", tags=["teams"])
async def set_primary_team(organization_id: uuid.UUID, team_id: uuid.UUID, member_id: uuid.UUID,
                           membership: CurrentMembership, session: DBSession) -> TeamMemberResponse:
    require_org_admin(membership)
    await scoped_team(session, organization_id, team_id)
    target = await session.scalar(select(TeamMembership).where(
        TeamMembership.organization_id == organization_id,
        TeamMembership.team_id == team_id, TeamMembership.membership_id == member_id))
    if target is None:
        raise ResourceNotFoundException("Team member not found")
    await session.execute(update(TeamMembership).where(
        TeamMembership.organization_id == organization_id,
        TeamMembership.membership_id == member_id).values(is_primary=False))
    target.is_primary = True
    org_member = await session.get(OrganizationMembership, member_id)
    assert org_member is not None
    user = await session.get(User, org_member.user_id)
    assert user is not None
    await session.commit()
    return TeamMemberResponse(member_id=member_id, user_id=user.id,
        name=f"{user.first_name} {user.last_name}", is_lead=target.is_lead, is_primary=True)


@router.delete("/organizations/{organization_id}/teams/{team_id}/members/{member_id}", status_code=204, tags=["teams"])
async def remove_team_member(organization_id: uuid.UUID, team_id: uuid.UUID,
                             member_id: uuid.UUID, membership: CurrentMembership,
                             session: DBSession) -> None:
    require_org_admin(membership)
    await scoped_team(session, organization_id, team_id)
    target = await session.scalar(select(TeamMembership).where(
        TeamMembership.organization_id == organization_id,
        TeamMembership.team_id == team_id,
        TeamMembership.membership_id == member_id))
    if target is None:
        raise ResourceNotFoundException("Team member not found")
    if target.is_primary:
        raise ConflictException("Assign another primary team before removing this member")
    await session.delete(target)
    await session.commit()
