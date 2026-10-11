import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import (
    ConflictException,
    ResourceNotFoundException,
    ValidationException,
)
from app.models import Organization, OrganizationInvite, OrganizationMembership, User
from app.security import hash_password


def normalize_email(email: str) -> str:
    return email.strip().lower()


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class WorkspaceService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_user(self, first_name: str, last_name: str, email: str, password: str) -> User:
        email = normalize_email(email)
        if await self.session.scalar(select(User.id).where(User.email == email)):
            raise ConflictException("An account with this email already exists", "email")
        user = User(first_name=first_name, last_name=last_name, email=email,
                    password=hash_password(password), is_active=True, is_admin=False)
        self.session.add(user)
        await self.session.flush()
        return user

    async def create_organization(self, user: User, name: str) -> Organization:
        base = "-".join(name.lower().split())[:80].strip("-") or "team"
        slug = f"{base}-{secrets.token_hex(3)}"
        org = Organization(name=name, slug=slug)
        self.session.add(org)
        await self.session.flush()
        self.session.add(OrganizationMembership(organization_id=org.id, user_id=user.id, role="owner"))
        await self.session.flush()
        return org

    async def create_invite(self, org_id: uuid.UUID, email: str, role: str) -> tuple[OrganizationInvite, str]:
        email = normalize_email(email)
        existing = await self.session.scalar(
            select(OrganizationMembership.id).join(User, User.id == OrganizationMembership.user_id)
            .where(OrganizationMembership.organization_id == org_id, User.email == email,
                   OrganizationMembership.revoked_at.is_(None))
        )
        if existing:
            raise ConflictException("User is already a member", "email")
        token = secrets.token_urlsafe(32)
        invite = OrganizationInvite(organization_id=org_id, email=email, role=role,
                                    token_hash=token_digest(token),
                                    expires_at=datetime.now(UTC) + timedelta(days=7))
        self.session.add(invite)
        await self.session.flush()
        return invite, token

    async def redeem_invite(self, token: str, user: User) -> OrganizationMembership:
        invite = await self.session.scalar(
            select(OrganizationInvite).where(OrganizationInvite.token_hash == token_digest(token)).with_for_update()
        )
        if invite is None or invite.redeemed_at or invite.expires_at <= datetime.now(UTC):
            raise ResourceNotFoundException("Invitation is invalid or expired")
        if invite.email != user.email:
            raise ValidationException("Invitation is for another email address", "email")
        org = await self.session.get(Organization, invite.organization_id)
        if org is None or org.suspended_at is not None:
            raise ResourceNotFoundException("Organization not found")
        existing = await self.session.scalar(
            select(OrganizationMembership).where(
                OrganizationMembership.organization_id == invite.organization_id,
                OrganizationMembership.user_id == user.id,
            )
        )
        if existing and existing.revoked_at is None:
            raise ConflictException("Already a member")
        if existing:
            existing.revoked_at = None
            existing.role = invite.role
            membership = existing
        else:
            membership = OrganizationMembership(organization_id=invite.organization_id,
                                                user_id=user.id, role=invite.role)
            self.session.add(membership)
        invite.redeemed_at = datetime.now(UTC)
        await self.session.flush()
        return membership
