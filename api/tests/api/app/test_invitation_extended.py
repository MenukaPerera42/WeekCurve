import asyncio
from datetime import UTC, datetime
from uuid import NAMESPACE_URL, uuid5

import pytest
from sqlalchemy import func, select

from app.models import Organization, OrganizationInvite, OrganizationMembership, User
from app.security import JWT_AUDIENCE_APP, generate_jwt_token, hash_password
from app.services.workspace import token_digest

ORIGIN = {"origin": "http://localhost:3001"}
PASSWORD = "long-test-password"


@pytest.fixture
async def invitation_case(session_factory, request):
    suffix = uuid5(NAMESPACE_URL, request.node.name).hex
    async with session_factory() as db:
        owner = User(
            first_name="Target", last_name="Owner",
            email=f"target-owner-{suffix}@test.dev",
            password=hash_password(PASSWORD), is_active=True, is_admin=False,
        )
        admin = User(
            first_name="Target", last_name="Admin",
            email=f"target-admin-{suffix}@test.dev",
            password=hash_password(PASSWORD), is_active=True, is_admin=False,
        )
        member = User(
            first_name="Target", last_name="Member",
            email=f"target-member-{suffix}@test.dev",
            password=hash_password(PASSWORD), is_active=True, is_admin=False,
        )
        existing = User(
            first_name="Existing", last_name="Owner",
            email=f"existing-{suffix}@test.dev",
            password=hash_password(PASSWORD), is_active=True, is_admin=False,
        )
        db.add_all([owner, admin, member, existing])
        await db.flush()
        target_org = Organization(name="Inviting Org", slug=f"inviting-{suffix}")
        original_org = Organization(name="Original Org", slug=f"original-{suffix}")
        db.add_all([target_org, original_org])
        await db.flush()
        db.add_all([
            OrganizationMembership(
                organization_id=target_org.id, user_id=owner.id, role="owner"
            ),
            OrganizationMembership(
                organization_id=target_org.id, user_id=admin.id, role="admin"
            ),
            OrganizationMembership(
                organization_id=target_org.id, user_id=member.id, role="member"
            ),
            OrganizationMembership(
                organization_id=original_org.id, user_id=existing.id,
                role="owner",
            ),
        ])
        await db.commit()
        return {
            "target_org": target_org.id, "original_org": original_org.id,
            "owner": owner.id, "admin": admin.id, "member": member.id,
            "existing": existing.id, "existing_email": existing.email,
            "new_email": f"new-{suffix}@test.dev",
        }


@pytest.mark.asyncio
async def test_expired_invite_cannot_create_user_or_membership(
    async_client, session_factory, invitation_case
):
    case = invitation_case
    async_client.cookies.set(
        "access_token",
        f"Bearer {generate_jwt_token({'sub': str(case['owner'])}, JWT_AUDIENCE_APP)}",
    )
    created = await async_client.post(
        f"/app/organizations/{case['target_org']}/invitations",
        headers=ORIGIN, json={"email": case["new_email"], "role": "member"},
    )
    assert created.status_code == 201, created.text
    token = created.json()["token"]
    async with session_factory() as db:
        invite = await db.scalar(select(OrganizationInvite).where(
            OrganizationInvite.token_hash == token_digest(token)
        ))
        assert invite is not None and invite.token_hash != token
        invite.expires_at = datetime(2000, 1, 1, tzinfo=UTC)
        await db.commit()
    async_client.cookies.clear()
    preview = await async_client.get(f"/app/invitations/{token}")
    signup = await async_client.post("/app/signup", json={
        "first_name": "New", "last_name": "Member",
        "email": case["new_email"], "password": PASSWORD,
        "invite_token": token,
    })
    assert preview.status_code == 404
    assert signup.status_code == 404
    async with session_factory() as db:
        user = await db.scalar(select(User).where(User.email == case["new_email"]))
        invite = await db.scalar(select(OrganizationInvite).where(
            OrganizationInvite.token_hash == token_digest(token)
        ))
        count = await db.scalar(select(func.count()).select_from(
            OrganizationMembership
        ).where(OrganizationMembership.organization_id == case["target_org"]))
        assert user is None
        assert invite is not None and invite.redeemed_at is None
        assert count == 3


@pytest.mark.asyncio
async def test_existing_user_accepts_invite_without_losing_original_membership(
    async_client, session_factory, invitation_case
):
    case = invitation_case
    async_client.cookies.set(
        "access_token",
        f"Bearer {generate_jwt_token({'sub': str(case['owner'])}, JWT_AUDIENCE_APP)}",
    )
    created = await async_client.post(
        f"/app/organizations/{case['target_org']}/invitations",
        headers=ORIGIN, json={"email": case["existing_email"], "role": "member"},
    )
    assert created.status_code == 201, created.text
    token = created.json()["token"]
    async_client.cookies.clear()
    async_client.cookies.set(
        "access_token",
        f"Bearer {generate_jwt_token({'sub': str(case['existing'])}, JWT_AUDIENCE_APP)}",
    )
    accepted = await async_client.post(
        f"/app/invitations/{token}/accept", headers=ORIGIN
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["id"] == str(case["target_org"])
    assert accepted.json()["role"] == "member"
    organizations = await async_client.get("/app/organizations")
    assert organizations.status_code == 200
    assert {row["id"] for row in organizations.json()} >= {
        str(case["target_org"]), str(case["original_org"])
    }
    replay = await async_client.post(
        f"/app/invitations/{token}/accept", headers=ORIGIN
    )
    assert replay.status_code == 404
    async with session_factory() as db:
        memberships = (await db.scalars(select(OrganizationMembership).where(
            OrganizationMembership.user_id == case["existing"]
        ))).all()
        assert {m.organization_id: m.role for m in memberships} == {
            case["original_org"]: "owner", case["target_org"]: "member"
        }
        invite = await db.scalar(select(OrganizationInvite).where(
            OrganizationInvite.token_hash == token_digest(token)
        ))
        assert invite is not None and invite.redeemed_at is not None


@pytest.mark.asyncio
async def test_ordinary_member_cannot_issue_invitations(
    async_client, session_factory, invitation_case
):
    case = invitation_case
    async_client.cookies.set(
        "access_token",
        f"Bearer {generate_jwt_token({'sub': str(case['member'])}, JWT_AUDIENCE_APP)}",
    )
    for role in ("member", "admin"):
        response = await async_client.post(
            f"/app/organizations/{case['target_org']}/invitations",
            headers=ORIGIN, json={"email": case["new_email"], "role": role},
        )
        assert response.status_code == 403
    async with session_factory() as db:
        count = await db.scalar(select(func.count()).select_from(
            OrganizationInvite
        ).where(OrganizationInvite.organization_id == case["target_org"]))
        assert count == 0


@pytest.mark.asyncio
async def test_invite_role_cannot_escalate_to_owner_or_platform_staff(
    async_client, session_factory, invitation_case
):
    case = invitation_case
    url = f"/app/organizations/{case['target_org']}/invitations"
    async_client.cookies.set(
        "access_token",
        f"Bearer {generate_jwt_token({'sub': str(case['admin'])}, JWT_AUDIENCE_APP)}",
    )
    forbidden_admin = await async_client.post(
        url, headers=ORIGIN,
        json={"email": case["existing_email"], "role": "admin"},
    )
    assert forbidden_admin.status_code == 403
    async_client.cookies.clear()
    async_client.cookies.set(
        "access_token",
        f"Bearer {generate_jwt_token({'sub': str(case['owner'])}, JWT_AUDIENCE_APP)}",
    )
    for forbidden_role in ("owner", "staff"):
        response = await async_client.post(
            url, headers=ORIGIN,
            json={"email": case["existing_email"], "role": forbidden_role},
        )
        assert response.status_code == 422
    created = await async_client.post(
        url, headers=ORIGIN,
        json={"email": case["existing_email"], "role": "admin"},
    )
    assert created.status_code == 201, created.text
    token = created.json()["token"]
    async_client.cookies.clear()
    async_client.cookies.set(
        "access_token",
        f"Bearer {generate_jwt_token({'sub': str(case['existing'])}, JWT_AUDIENCE_APP)}",
    )
    accepted = await async_client.post(
        f"/app/invitations/{token}/accept", headers=ORIGIN
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["role"] == "admin"
    async with session_factory() as db:
        user = await db.get(User, case["existing"])
        target_member = await db.scalar(select(OrganizationMembership).where(
            OrganizationMembership.organization_id == case["target_org"],
            OrganizationMembership.user_id == case["existing"],
        ))
        count = await db.scalar(select(func.count()).select_from(
            OrganizationInvite
        ).where(OrganizationInvite.organization_id == case["target_org"]))
        assert user is not None and user.is_admin is False
        assert target_member is not None and target_member.role == "admin"
        assert count == 1


@pytest.mark.asyncio
async def test_concurrent_acceptance_redeems_one_invite_once(
    async_client, session_factory, invitation_case
):
    case = invitation_case
    async_client.cookies.set(
        "access_token",
        f"Bearer {generate_jwt_token({'sub': str(case['owner'])}, JWT_AUDIENCE_APP)}",
    )
    created = await async_client.post(
        f"/app/organizations/{case['target_org']}/invitations",
        headers=ORIGIN, json={"email": case["existing_email"], "role": "member"},
    )
    assert created.status_code == 201, created.text
    token = created.json()["token"]
    async_client.cookies.clear()
    async_client.cookies.set(
        "access_token",
        f"Bearer {generate_jwt_token({'sub': str(case['existing'])}, JWT_AUDIENCE_APP)}",
    )
    url = f"/app/invitations/{token}/accept"
    first, second = await asyncio.gather(
        async_client.post(url, headers=ORIGIN),
        async_client.post(url, headers=ORIGIN),
    )
    assert sorted((first.status_code, second.status_code)) == [200, 404]
    async with session_factory() as db:
        memberships = (await db.scalars(select(OrganizationMembership).where(
            OrganizationMembership.organization_id == case["target_org"],
            OrganizationMembership.user_id == case["existing"],
        ))).all()
        invite = await db.scalar(select(OrganizationInvite).where(
            OrganizationInvite.token_hash == token_digest(token)
        ))
        assert len(memberships) == 1
        assert memberships[0].role == "member"
        assert invite is not None and invite.redeemed_at is not None
