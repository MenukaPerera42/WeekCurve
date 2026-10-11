from datetime import UTC, datetime

import pytest

from app.models import Organization, OrganizationMembership, User
from app.security import (
    JWT_AUDIENCE_APP,
    JWT_AUDIENCE_INTERNAL,
    generate_jwt_token,
    hash_password,
)


def login_as(client, user_id, audience=JWT_AUDIENCE_APP):
    cookie = "internal_access_token" if audience == JWT_AUDIENCE_INTERNAL else "access_token"
    client.cookies.clear()
    client.cookies.set(cookie, f"Bearer {generate_jwt_token({'sub': str(user_id)}, audience)}")


@pytest.mark.asyncio
async def test_cross_organization_ids_are_hidden(async_client, session_factory):
    async with session_factory() as db:
        a = User(first_name="A", last_name="Owner", email="a@example.test",
                 password=hash_password("long-password-a"), is_active=True, is_admin=False)
        b = User(first_name="B", last_name="Owner", email="b@example.test",
                 password=hash_password("long-password-b"), is_active=True, is_admin=False)
        db.add_all([a, b])
        await db.flush()
        org_a = Organization(name="A", slug="a")
        org_b = Organization(name="B", slug="b")
        db.add_all([org_a, org_b])
        await db.flush()
        db.add_all([
            OrganizationMembership(organization_id=org_a.id, user_id=a.id, role="owner"),
            OrganizationMembership(organization_id=org_b.id, user_id=b.id, role="owner"),
        ])
        await db.commit()
        a_id, b_id, org_a_id, org_b_id = a.id, b.id, org_a.id, org_b.id
    login_as(async_client, b_id)
    foreign_get = await async_client.get(f"/app/organizations/{org_a_id}")
    foreign_write = await async_client.post(f"/app/organizations/{org_a_id}/teams",
        json={"name": "Intrusion"}, headers={"origin": "http://localhost:3001"})
    own_get = await async_client.get(f"/app/organizations/{org_b_id}")
    assert foreign_get.status_code == 404
    assert foreign_write.status_code == 404
    assert own_get.status_code == 200
    login_as(async_client, a_id)
    assert (await async_client.get(f"/app/organizations/{org_b_id}")).status_code == 404


@pytest.mark.asyncio
async def test_customer_token_cannot_reach_internal(async_client, session_factory):
    async with session_factory() as db:
        owner = User(first_name="Org", last_name="Admin", email="admin@example.test",
                     password=hash_password("long-password"), is_active=True, is_admin=False)
        db.add(owner)
        await db.commit()
        owner_id = owner.id
    login_as(async_client, owner_id)
    assert (await async_client.get("/internal/organizations")).status_code == 401
    login_as(async_client, owner_id, JWT_AUDIENCE_INTERNAL)
    assert (await async_client.get("/internal/organizations")).status_code == 403


@pytest.mark.asyncio
async def test_suspended_org_revokes_only_that_membership(async_client, session_factory):
    async with session_factory() as db:
        user = User(first_name="Multi", last_name="Org", email="multi@example.test",
                    password=hash_password("long-password"), is_active=True, is_admin=False)
        db.add(user)
        await db.flush()
        suspended = Organization(name="Suspended", slug="suspended", suspended_at=datetime.now(UTC))
        active = Organization(name="Active", slug="active")
        db.add_all([suspended, active])
        await db.flush()
        db.add_all([
            OrganizationMembership(organization_id=suspended.id, user_id=user.id, role="member"),
            OrganizationMembership(organization_id=active.id, user_id=user.id, role="member"),
        ])
        await db.commit()
        user_id, suspended_id, active_id = user.id, suspended.id, active.id
    login_as(async_client, user_id)
    assert (await async_client.get(f"/app/organizations/{suspended_id}")).status_code == 404
    assert (await async_client.get(f"/app/organizations/{active_id}")).status_code == 200
