from uuid import uuid4

import pytest

from app.security import JWT_AUDIENCE_APP, generate_jwt_token


@pytest.mark.asyncio
async def test_invite_is_email_bound_and_single_use(async_client):
    unique = uuid4().hex
    owner_email = f"owner-{unique}@test.dev"
    member_email = f"member-{unique}@test.dev"
    org = await async_client.post("/app/signup", json={
        "first_name": "Owner", "last_name": "One", "email": owner_email,
        "password": "StrongPassword123!", "organization_name": "Test Studio"})
    assert org.status_code == 201, org.text
    org_id = org.json()["organization"]["id"]
    owner_id = org.json()["user_id"]
    async_client.cookies.set("access_token", f"Bearer {generate_jwt_token({'sub': owner_id}, JWT_AUDIENCE_APP)}")
    created = await async_client.post(f"/app/organizations/{org_id}/invitations",
        headers={"origin": "http://localhost:3001"},
        json={"email": member_email, "role": "member"})
    assert created.status_code == 201, created.text
    token = created.json()["token"]
    async_client.cookies.clear()
    wrong = await async_client.post("/app/signup", json={
        "first_name": "Wrong", "last_name": "Person", "email": f"wrong-{unique}@test.dev",
        "password": "StrongPassword123!", "invite_token": token})
    assert wrong.status_code == 400
    accepted = await async_client.post("/app/signup", json={
        "first_name": "Member", "last_name": "One", "email": member_email,
        "password": "StrongPassword123!", "invite_token": token})
    assert accepted.status_code == 201, accepted.text
    replay = await async_client.get(f"/app/invitations/{token}")
    assert replay.status_code == 404
