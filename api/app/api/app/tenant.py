import uuid
from typing import Annotated

from fastapi import Depends, Path, status
from sqlalchemy import select

from app.api.app.access import CurrentUser
from app.database import DBSession
from app.exceptions import APIException, ResourceNotFoundException
from app.models import Organization, OrganizationMembership


async def get_membership(
    organization_id: Annotated[uuid.UUID, Path()],
    user: CurrentUser,
    session: DBSession,
) -> OrganizationMembership:
    membership = await session.scalar(
        select(OrganizationMembership)
        .join(Organization, Organization.id == OrganizationMembership.organization_id)
        .where(
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.revoked_at.is_(None),
            Organization.suspended_at.is_(None),
        )
    )
    if membership is None:
        raise ResourceNotFoundException("Organization not found")
    return membership


CurrentMembership = Annotated[OrganizationMembership, Depends(get_membership)]


def require_org_admin(membership: OrganizationMembership) -> None:
    if membership.role not in ("owner", "admin"):
        raise APIException(status.HTTP_403_FORBIDDEN, "FORBIDDEN", "Organization administrator required")


def require_owner(membership: OrganizationMembership) -> None:
    if membership.role != "owner":
        raise APIException(status.HTTP_403_FORBIDDEN, "FORBIDDEN", "Organization owner required")
