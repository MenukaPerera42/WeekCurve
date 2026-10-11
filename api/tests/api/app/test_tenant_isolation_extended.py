from datetime import UTC, date, datetime

import pytest
from sqlalchemy import func, select

from app.models import (
    Organization,
    OrganizationMembership,
    PlanTask,
    Team,
    TeamMembership,
    User,
    WeeklyPlan,
)
from app.security import JWT_AUDIENCE_APP, generate_jwt_token, hash_password


def as_user(client, user_id):
    client.cookies.clear()
    client.cookies.set(
        "access_token",
        f"Bearer {generate_jwt_token({'sub': str(user_id)}, JWT_AUDIENCE_APP)}",
    )


@pytest.fixture
async def tenants(session_factory, request):
    # Names are stable per test and unique within the shared Testcontainers database.
    suffix = request.node.name
    async with session_factory() as db:
        a_lead = User(
            first_name="A", last_name="Lead", email=f"a-lead-{suffix}@test.dev",
            password=hash_password("long-test-password"), is_active=True, is_admin=False,
        )
        b_author = User(
            first_name="B", last_name="Author", email=f"b-author-{suffix}@test.dev",
            password=hash_password("long-test-password"), is_active=True, is_admin=False,
        )
        b_lead = User(
            first_name="B", last_name="Lead", email=f"b-lead-{suffix}@test.dev",
            password=hash_password("long-test-password"), is_active=True, is_admin=False,
        )
        former = User(
            first_name="Former", last_name="Member", email=f"former-{suffix}@test.dev",
            password=hash_password("long-test-password"), is_active=True, is_admin=False,
        )
        db.add_all([a_lead, b_author, b_lead, former])
        await db.flush()

        org_a = Organization(name="Tenant A", slug=f"tenant-a-{suffix}")
        org_b = Organization(name="Tenant B", slug=f"tenant-b-{suffix}")
        db.add_all([org_a, org_b])
        await db.flush()

        a_membership = OrganizationMembership(
            organization_id=org_a.id, user_id=a_lead.id, role="owner"
        )
        b_author_membership = OrganizationMembership(
            organization_id=org_b.id, user_id=b_author.id, role="member"
        )
        b_lead_membership = OrganizationMembership(
            organization_id=org_b.id, user_id=b_lead.id, role="member"
        )
        former_membership = OrganizationMembership(
            organization_id=org_a.id, user_id=former.id, role="member"
        )
        db.add_all([
            a_membership, b_author_membership, b_lead_membership, former_membership
        ])
        await db.flush()

        team_a = Team(organization_id=org_a.id, name="Engineering A")
        team_b = Team(organization_id=org_b.id, name="Engineering B")
        db.add_all([team_a, team_b])
        await db.flush()
        db.add_all([
            TeamMembership(
                organization_id=org_a.id, team_id=team_a.id,
                membership_id=a_membership.id, is_primary=True, is_lead=True,
            ),
            TeamMembership(
                organization_id=org_b.id, team_id=team_b.id,
                membership_id=b_author_membership.id, is_primary=True, is_lead=False,
            ),
            TeamMembership(
                organization_id=org_b.id, team_id=team_b.id,
                membership_id=b_lead_membership.id, is_primary=True, is_lead=True,
            ),
        ])
        submitted = WeeklyPlan(
            organization_id=org_b.id, author_membership_id=b_author_membership.id,
            primary_team_id=team_b.id, week_start=date(2026, 10, 5),
            status="submitted",
        )
        approved = WeeklyPlan(
            organization_id=org_b.id, author_membership_id=b_author_membership.id,
            primary_team_id=team_b.id, week_start=date(2026, 9, 28),
            status="approved",
        )
        db.add_all([submitted, approved])
        await db.flush()
        task = PlanTask(
            organization_id=org_b.id, plan_id=approved.id, kind="main",
            text="Checkout handles expired cards on staging",
            why_it_matters="Customers can recover", position=0, is_done=False,
        )
        db.add(task)
        await db.commit()
        return {
            "org_a": org_a.id, "org_b": org_b.id,
            "a_lead": a_lead.id, "former": former.id,
            "former_membership": former_membership.id,
            "b_author_membership": b_author_membership.id,
            "team_a": team_a.id, "team_b": team_b.id,
            "submitted": submitted.id, "approved": approved.id, "task": task.id,
        }


@pytest.mark.asyncio
async def test_foreign_plan_id_cannot_be_read_under_either_organization(
    async_client, session_factory, tenants
):
    as_user(async_client, tenants["a_lead"])
    for org_id in (tenants["org_a"], tenants["org_b"]):
        response = await async_client.get(
            f"/app/organizations/{org_id}/plans/{tenants['approved']}"
        )
        assert response.status_code == 404
    async with session_factory() as db:
        plan = await db.get(WeeklyPlan, tenants["approved"])
        assert plan is not None and plan.status == "approved"


@pytest.mark.asyncio
async def test_foreign_task_id_cannot_be_completed_or_changed(
    async_client, session_factory, tenants
):
    as_user(async_client, tenants["a_lead"])
    for org_id in (tenants["org_a"], tenants["org_b"]):
        response = await async_client.patch(
            f"/app/organizations/{org_id}/plans/{tenants['approved']}/tasks/{tenants['task']}",
            json={"is_done": True}, headers={"origin": "http://localhost:3001"},
        )
        assert response.status_code == 404
    async with session_factory() as db:
        task = await db.get(PlanTask, tenants["task"])
        assert task is not None and task.is_done is False


@pytest.mark.asyncio
async def test_lead_cannot_approve_other_organizations_plan(
    async_client, session_factory, tenants
):
    as_user(async_client, tenants["a_lead"])
    for org_id in (tenants["org_a"], tenants["org_b"]):
        response = await async_client.post(
            f"/app/organizations/{org_id}/plans/{tenants['submitted']}/approve",
            json={}, headers={"origin": "http://localhost:3001"},
        )
        assert response.status_code == 404
    async with session_factory() as db:
        plan = await db.get(WeeklyPlan, tenants["submitted"])
        assert plan is not None and plan.status == "submitted"


@pytest.mark.asyncio
async def test_cross_organization_team_and_membership_references_are_rejected(
    async_client, session_factory, tenants
):
    as_user(async_client, tenants["a_lead"])
    headers = {"origin": "http://localhost:3001"}
    foreign_member = await async_client.post(
        f"/app/organizations/{tenants['org_a']}/teams/{tenants['team_a']}/members",
        json={"member_id": str(tenants["b_author_membership"]), "is_primary": False},
        headers=headers,
    )
    foreign_team = await async_client.post(
        f"/app/organizations/{tenants['org_a']}/teams/{tenants['team_b']}/members",
        json={"member_id": str(tenants["former_membership"]), "is_primary": False},
        headers=headers,
    )
    assert foreign_member.status_code == 404
    assert foreign_team.status_code == 404
    async with session_factory() as db:
        a_count = await db.scalar(
            select(func.count()).select_from(TeamMembership).where(
                TeamMembership.team_id == tenants["team_a"]
            )
        )
        b_count = await db.scalar(
            select(func.count()).select_from(TeamMembership).where(
                TeamMembership.team_id == tenants["team_b"]
            )
        )
        assert a_count == 1
        assert b_count == 2


@pytest.mark.asyncio
async def test_revoked_membership_loses_existing_token_access(
    async_client, session_factory, tenants
):
    as_user(async_client, tenants["former"])
    before = await async_client.get(
        f"/app/organizations/{tenants['org_a']}/teams"
    )
    assert before.status_code == 200
    async with session_factory() as db:
        membership = await db.get(
            OrganizationMembership, tenants["former_membership"]
        )
        assert membership is not None
        membership.revoked_at = datetime.now(UTC)
        await db.commit()

    denied_read = await async_client.get(
        f"/app/organizations/{tenants['org_a']}/teams"
    )
    denied_write = await async_client.put(
        f"/app/organizations/{tenants['org_a']}/plans/weeks/2026-10-05",
        json={"tasks": [
            {"kind": "main", "text": "Checkout works on staging",
             "why_it_matters": "Customers can pay"},
            {"kind": "sub_goal", "text": "Expired-card tests pass"},
        ]},
        headers={"origin": "http://localhost:3001"},
    )
    assert denied_read.status_code == 404
    assert denied_write.status_code == 404
    async with session_factory() as db:
        count = await db.scalar(
            select(func.count()).select_from(WeeklyPlan).where(
                WeeklyPlan.organization_id == tenants["org_a"]
            )
        )
        assert count == 0
