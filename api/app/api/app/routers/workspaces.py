import uuid

from fastapi import APIRouter, status
from pydantic import EmailStr, Field
from sqlalchemy import select

from app.api.app.access import CurrentUser
from app.api.app.tenant import CurrentMembership, require_org_admin, require_owner
from app.database import DBSession
from app.exceptions import ResourceNotFoundException, ValidationException
from app.models import Organization, OrganizationMembership, User
from app.schemas import Model
from app.services.workspace import WorkspaceService, token_digest

router = APIRouter()


class SignupRequest(Model):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    organization_name: str | None = Field(default=None, min_length=2, max_length=120)
    invite_token: str | None = None


class OrganizationResponse(Model):
    id: uuid.UUID
    name: str
    slug: str
    role: str


class SignupResponse(Model):
    user_id: uuid.UUID
    organization: OrganizationResponse


class OrganizationUpdate(Model):
    name: str = Field(min_length=2, max_length=120)


class InviteRequest(Model):
    email: EmailStr
    role: str = Field(pattern="^(admin|member)$")


class InviteResponse(Model):
    token: str
    expires_at: str


class InvitePreview(Model):
    organization_name: str
    email: str
    role: str


class MemberResponse(Model):
    id: uuid.UUID
    user_id: uuid.UUID
    first_name: str
    last_name: str
    email: str
    role: str


class MemberUpdate(Model):
    role: str = Field(pattern="^(admin|member)$")


@router.post("/signup", status_code=status.HTTP_201_CREATED, tags=["auth"])
async def signup(data: SignupRequest, session: DBSession) -> SignupResponse:
    if bool(data.organization_name) == bool(data.invite_token):
        raise ValidationException("Provide either an organization name or an invitation")
    service = WorkspaceService(session)
    user = await service.create_user(data.first_name, data.last_name, str(data.email), data.password)
    if data.invite_token:
        membership = await service.redeem_invite(data.invite_token, user)
        org = await session.get(Organization, membership.organization_id)
    else:
        org = await service.create_organization(user, data.organization_name or "")
        membership = await session.scalar(select(OrganizationMembership).where(
            OrganizationMembership.organization_id == org.id,
            OrganizationMembership.user_id == user.id))
    assert org is not None and membership is not None
    await session.commit()
    return SignupResponse(user_id=user.id, organization=OrganizationResponse(
        id=org.id, name=org.name, slug=org.slug, role=membership.role))


@router.get("/invitations/{token}", tags=["organizations"])
async def preview_invite(token: str, session: DBSession) -> InvitePreview:
    from datetime import UTC, datetime

    from app.models import OrganizationInvite
    invite = await session.scalar(select(OrganizationInvite).where(OrganizationInvite.token_hash == token_digest(token)))
    if invite is None or invite.redeemed_at or invite.expires_at <= datetime.now(UTC):
        raise ResourceNotFoundException("Invitation is invalid or expired")
    org = await session.get(Organization, invite.organization_id)
    if org is None or org.suspended_at:
        raise ResourceNotFoundException("Organization not found")
    return InvitePreview(organization_name=org.name, email=invite.email, role=invite.role)


@router.post("/invitations/{token}/accept", tags=["organizations"])
async def accept_invite(token: str, user: CurrentUser, session: DBSession) -> OrganizationResponse:
    membership = await WorkspaceService(session).redeem_invite(token, user)
    org = await session.get(Organization, membership.organization_id)
    assert org is not None
    await session.commit()
    return OrganizationResponse(id=org.id, name=org.name, slug=org.slug, role=membership.role)


@router.get("/organizations", tags=["organizations"])
async def list_organizations(user: CurrentUser, session: DBSession) -> list[OrganizationResponse]:
    rows = (await session.execute(select(Organization, OrganizationMembership.role)
        .join(OrganizationMembership, OrganizationMembership.organization_id == Organization.id)
        .where(OrganizationMembership.user_id == user.id, Organization.suspended_at.is_(None))
        .where(OrganizationMembership.revoked_at.is_(None))
        .order_by(Organization.name))).all()
    return [OrganizationResponse(id=o.id, name=o.name, slug=o.slug, role=role) for o, role in rows]


@router.get("/organizations/{organization_id}", tags=["organizations"])
async def get_organization(organization_id: uuid.UUID, membership: CurrentMembership, session: DBSession) -> OrganizationResponse:
    org = await session.get(Organization, organization_id)
    assert org is not None
    return OrganizationResponse(id=org.id, name=org.name, slug=org.slug, role=membership.role)


@router.patch("/organizations/{organization_id}", tags=["organizations"])
async def update_organization(organization_id: uuid.UUID, data: OrganizationUpdate, membership: CurrentMembership, session: DBSession) -> OrganizationResponse:
    require_org_admin(membership)
    org = await session.get(Organization, organization_id)
    assert org is not None
    org.name = data.name
    await session.commit()
    return OrganizationResponse(id=org.id, name=org.name, slug=org.slug, role=membership.role)


@router.post("/organizations/{organization_id}/invitations", status_code=201, tags=["organizations"])
async def create_invite(organization_id: uuid.UUID, data: InviteRequest, membership: CurrentMembership, session: DBSession) -> InviteResponse:
    require_org_admin(membership)
    if data.role == "admin":
        require_owner(membership)
    invite, token = await WorkspaceService(session).create_invite(organization_id, str(data.email), data.role)
    await session.commit()
    return InviteResponse(token=token, expires_at=invite.expires_at.isoformat())


@router.get("/organizations/{organization_id}/members", tags=["organizations"])
async def list_members(organization_id: uuid.UUID, membership: CurrentMembership, session: DBSession) -> list[MemberResponse]:
    rows = (await session.execute(select(OrganizationMembership, User)
        .join(User, User.id == OrganizationMembership.user_id)
        .where(OrganizationMembership.organization_id == organization_id, OrganizationMembership.revoked_at.is_(None))
        .order_by(User.first_name, User.last_name))).all()
    return [MemberResponse(id=m.id, user_id=u.id, first_name=u.first_name,
        last_name=u.last_name, email=u.email, role=m.role) for m, u in rows]


@router.patch("/organizations/{organization_id}/members/{member_id}", tags=["organizations"])
async def update_member(organization_id: uuid.UUID, member_id: uuid.UUID, data: MemberUpdate,
                        membership: CurrentMembership, session: DBSession) -> MemberResponse:
    require_owner(membership)
    target = await session.scalar(select(OrganizationMembership).where(
        OrganizationMembership.id == member_id, OrganizationMembership.organization_id == organization_id))
    if target is None or target.role == "owner" or target.revoked_at is not None:
        raise ResourceNotFoundException("Member not found")
    target.role = data.role
    user = await session.get(User, target.user_id)
    assert user is not None
    await session.commit()
    return MemberResponse(id=target.id, user_id=user.id, first_name=user.first_name,
                          last_name=user.last_name, email=user.email, role=target.role)


@router.delete("/organizations/{organization_id}/members/{member_id}", status_code=204, tags=["organizations"])
async def remove_member(organization_id: uuid.UUID, member_id: uuid.UUID,
                        membership: CurrentMembership, session: DBSession) -> None:
    from datetime import UTC, datetime

    from sqlalchemy import delete

    from app.models import TeamMembership
    require_org_admin(membership)
    target = await session.scalar(select(OrganizationMembership).where(
        OrganizationMembership.id == member_id,
        OrganizationMembership.organization_id == organization_id,
        OrganizationMembership.revoked_at.is_(None)))
    if target is None or target.role == "owner" or target.id == membership.id:
        raise ResourceNotFoundException("Member not found")
    if target.role == "admin":
        require_owner(membership)
    target.revoked_at = datetime.now(UTC)
    await session.execute(delete(TeamMembership).where(
        TeamMembership.organization_id == organization_id,
        TeamMembership.membership_id == member_id))
    await session.commit()
