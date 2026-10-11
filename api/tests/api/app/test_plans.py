from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.models import Organization, OrganizationMembership, Team, TeamMembership, User
from app.security import JWT_AUDIENCE_APP, generate_jwt_token, hash_password


def as_user(client, user_id):
    client.cookies.clear()
    client.cookies.set("access_token", f"Bearer {generate_jwt_token({'sub': str(user_id)}, JWT_AUDIENCE_APP)}")


@pytest.mark.asyncio
async def test_only_primary_team_lead_can_approve(async_client, session_factory):
    unique = uuid4().hex
    async with session_factory() as db:
        author = User(first_name="Author", last_name="A", email=f"author-{unique}@test.dev",
                      password=hash_password("long-password"), is_active=True, is_admin=False)
        lead = User(first_name="Lead", last_name="L", email=f"lead-{unique}@test.dev",
                    password=hash_password("long-password"), is_active=True, is_admin=False)
        outsider = User(first_name="Other", last_name="O", email=f"other-{unique}@test.dev",
                        password=hash_password("long-password"), is_active=True, is_admin=False)
        db.add_all([author, lead, outsider])
        await db.flush()
        org = Organization(name="A", slug=f"a-{unique}")
        db.add(org)
        await db.flush()
        author_m = OrganizationMembership(organization_id=org.id, user_id=author.id, role="member")
        lead_m = OrganizationMembership(organization_id=org.id, user_id=lead.id, role="member")
        other_m = OrganizationMembership(organization_id=org.id, user_id=outsider.id, role="admin")
        db.add_all([author_m, lead_m, other_m])
        await db.flush()
        team = Team(organization_id=org.id, name="Engineering")
        db.add(team)
        await db.flush()
        db.add_all([
            TeamMembership(organization_id=org.id, team_id=team.id, membership_id=author_m.id,
                           is_primary=True, is_lead=False),
            TeamMembership(organization_id=org.id, team_id=team.id, membership_id=lead_m.id,
                           is_primary=True, is_lead=True),
        ])
        await db.commit()
        org_id, author_id, lead_id, outsider_id = org.id, author.id, lead.id, outsider.id
    today = datetime.now(UTC).date()
    monday = today - timedelta(days=today.weekday())
    headers = {"origin": "http://localhost:3001"}
    as_user(async_client, author_id)
    saved = await async_client.put(f"/app/organizations/{org_id}/plans/weeks/{monday.isoformat()}",
        headers=headers, json={"tasks": [
            {"kind": "main", "text": "Checkout handles expired cards on staging", "why_it_matters": "Customers recover"},
            {"kind": "sub_goal", "text": "End-to-end expired card tests pass"},
        ]})
    assert saved.status_code == 200, saved.text
    plan_id = saved.json()["id"]
    assert (await async_client.post(f"/app/organizations/{org_id}/plans/{plan_id}/submit", headers=headers)).status_code == 200
    as_user(async_client, outsider_id)
    assert (await async_client.post(f"/app/organizations/{org_id}/plans/{plan_id}/approve",
        headers=headers, json={})).status_code == 404
    as_user(async_client, lead_id)
    approved = await async_client.post(f"/app/organizations/{org_id}/plans/{plan_id}/approve",
        headers=headers, json={})
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "approved"
