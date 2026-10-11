from datetime import date
from uuid import NAMESPACE_URL, uuid5

import pytest
from sqlalchemy import select

from app.models import (
    AIUsage,
    Organization,
    OrganizationMembership,
    PlanTask,
    Team,
    User,
    WeeklyPlan,
)
from app.security import (
    JWT_AUDIENCE_APP,
    JWT_AUDIENCE_INTERNAL,
    generate_jwt_token,
    hash_password,
)

ORIGIN = {"origin": "http://localhost:3002"}
PASSWORD = "long-test-password"
PRIVATE_PLAN_TEXT = "Private customer plan: checkout fixes card expiry"


def token_for(user_id, audience):
    return f"Bearer {generate_jwt_token({'sub': str(user_id)}, audience)}"


def as_user(client, user_id, audience):
    client.cookies.clear()
    cookie_name = (
        "internal_access_token"
        if audience == JWT_AUDIENCE_INTERNAL else "access_token"
    )
    client.cookies.set(cookie_name, token_for(user_id, audience))


@pytest.fixture
async def admin_case(session_factory, request):
    suffix = uuid5(NAMESPACE_URL, request.node.name).hex
    async with session_factory() as db:
        staff = User(
            first_name="Platform", last_name="Staff",
            email=f"staff-{suffix}@test.dev", password=hash_password(PASSWORD),
            is_active=True, is_admin=True,
        )
        owner = User(
            first_name="Org", last_name="Owner",
            email=f"owner-{suffix}@test.dev", password=hash_password(PASSWORD),
            is_active=True, is_admin=False,
        )
        member = User(
            first_name="Multi", last_name="Member",
            email=f"member-{suffix}@test.dev", password=hash_password(PASSWORD),
            is_active=True, is_admin=False,
        )
        db.add_all([staff, owner, member])
        await db.flush()
        org_a = Organization(name="Customer A", slug=f"customer-a-{suffix}")
        org_b = Organization(name="Customer B", slug=f"customer-b-{suffix}")
        db.add_all([org_a, org_b])
        await db.flush()
        owner_membership = OrganizationMembership(
            organization_id=org_a.id, user_id=owner.id, role="owner"
        )
        member_a = OrganizationMembership(
            organization_id=org_a.id, user_id=member.id, role="member"
        )
        member_b = OrganizationMembership(
            organization_id=org_b.id, user_id=member.id, role="member"
        )
        db.add_all([owner_membership, member_a, member_b])
        await db.flush()
        team_a = Team(organization_id=org_a.id, name="Engineering")
        db.add(team_a)
        await db.flush()
        plan = WeeklyPlan(
            organization_id=org_a.id, author_membership_id=member_a.id,
            primary_team_id=team_a.id, week_start=date(2026, 10, 5),
            status="draft",
        )
        db.add(plan)
        await db.flush()
        db.add(PlanTask(
            organization_id=org_a.id, plan_id=plan.id, kind="main",
            text=PRIVATE_PLAN_TEXT, why_it_matters="Customers can pay",
            position=0, is_done=False,
        ))
        for org_id, actor_id, outcome, status_code in (
            (org_a.id, member_a.id, "success", None),
            (org_a.id, member_a.id, "failure", 503),
            (org_a.id, member_a.id, "rate_limited", 429),
            (org_b.id, member_b.id, "success", None),
        ):
            db.add(AIUsage(
                organization_id=org_id, actor_membership_id=actor_id,
                feature="review", outcome=outcome, provider_status=status_code,
                model="gemini-3.5-flash-lite", latency_ms=25,
            ))
        await db.commit()
        return {
            "staff": staff.id, "owner": owner.id, "member": member.id,
            "owner_email": owner.email, "org_a": org_a.id, "org_b": org_b.id,
            "plan": plan.id,
        }


@pytest.mark.asyncio
async def test_organization_owner_cannot_use_platform_staff_endpoints(
    async_client, admin_case
):
    owner_login = await async_client.post(
        "/internal/auth",
        json={"email": admin_case["owner_email"], "password": PASSWORD},
    )
    assert owner_login.status_code == 401
    as_user(async_client, admin_case["owner"], JWT_AUDIENCE_INTERNAL)
    assert (await async_client.get("/internal/users")).status_code == 403
    assert (await async_client.get("/internal/organizations")).status_code == 403
    as_user(async_client, admin_case["staff"], JWT_AUDIENCE_INTERNAL)
    users = await async_client.get("/internal/users")
    organizations = await async_client.get("/internal/organizations")
    assert users.status_code == 200
    assert organizations.status_code == 200
    assert any(row["id"] == str(admin_case["org_a"]) for row in organizations.json())


@pytest.mark.asyncio
async def test_jwt_audiences_and_customer_membership_remain_separate(
    async_client, admin_case
):
    org_url = f"/app/organizations/{admin_case['org_a']}"
    as_user(async_client, admin_case["staff"], JWT_AUDIENCE_INTERNAL)
    assert (await async_client.get(org_url)).status_code == 401
    internal_header = {"Access-Token": token_for(
        admin_case["staff"], JWT_AUDIENCE_INTERNAL
    )}
    assert (await async_client.get(org_url, headers=internal_header)).status_code == 401
    as_user(async_client, admin_case["staff"], JWT_AUDIENCE_APP)
    assert (await async_client.get(org_url)).status_code == 404
    as_user(async_client, admin_case["owner"], JWT_AUDIENCE_APP)
    assert (await async_client.get("/internal/ai-usage")).status_code == 401


@pytest.mark.asyncio
async def test_staff_suspension_blocks_only_selected_organization(
    async_client, session_factory, admin_case
):
    org_a = admin_case["org_a"]
    org_b = admin_case["org_b"]
    as_user(async_client, admin_case["member"], JWT_AUDIENCE_APP)
    assert (await async_client.get(f"/app/organizations/{org_a}")).status_code == 200
    assert (await async_client.get(f"/app/organizations/{org_b}")).status_code == 200
    as_user(async_client, admin_case["staff"], JWT_AUDIENCE_INTERNAL)
    suspended = await async_client.post(
        f"/internal/organizations/{org_a}/suspend", headers=ORIGIN
    )
    assert suspended.status_code == 200, suspended.text
    assert suspended.json()["suspended_at"] is not None
    async with session_factory() as db:
        organization = await db.get(Organization, org_a)
        assert organization is not None and organization.suspended_at is not None
    as_user(async_client, admin_case["member"], JWT_AUDIENCE_APP)
    assert (await async_client.get(f"/app/organizations/{org_a}")).status_code == 404
    assert (await async_client.get(f"/app/organizations/{org_b}")).status_code == 200
    as_user(async_client, admin_case["staff"], JWT_AUDIENCE_INTERNAL)
    reinstated = await async_client.post(
        f"/internal/organizations/{org_a}/reinstate", headers=ORIGIN
    )
    assert reinstated.status_code == 200, reinstated.text
    assert reinstated.json()["suspended_at"] is None
    async with session_factory() as db:
        organization = await db.get(Organization, org_a)
        assert organization is not None and organization.suspended_at is None
    as_user(async_client, admin_case["member"], JWT_AUDIENCE_APP)
    assert (await async_client.get(f"/app/organizations/{org_a}")).status_code == 200


@pytest.mark.asyncio
async def test_staff_deactivation_revokes_existing_customer_session(
    async_client, session_factory, admin_case
):
    member_id = admin_case["member"]
    as_user(async_client, member_id, JWT_AUDIENCE_APP)
    assert (await async_client.get(
        f"/app/organizations/{admin_case['org_b']}"
    )).status_code == 200
    as_user(async_client, admin_case["owner"], JWT_AUDIENCE_INTERNAL)
    forbidden = await async_client.post(
        f"/internal/users/{member_id}/deactivate", headers=ORIGIN
    )
    assert forbidden.status_code == 403
    async with session_factory() as db:
        member = await db.get(User, member_id)
        assert member is not None and member.is_active is True
    as_user(async_client, admin_case["staff"], JWT_AUDIENCE_INTERNAL)
    deactivated = await async_client.post(
        f"/internal/users/{member_id}/deactivate", headers=ORIGIN
    )
    assert deactivated.status_code == 200, deactivated.text
    assert deactivated.json()["is_active"] is False
    async with session_factory() as db:
        member = await db.get(User, member_id)
        assert member is not None and member.is_active is False
    as_user(async_client, member_id, JWT_AUDIENCE_APP)
    assert (await async_client.get(
        f"/app/organizations/{admin_case['org_b']}"
    )).status_code == 401


@pytest.mark.asyncio
async def test_ai_usage_is_staff_only_aggregated_and_excludes_plan_text(
    async_client, session_factory, admin_case
):
    as_user(async_client, admin_case["staff"], JWT_AUDIENCE_INTERNAL)
    response = await async_client.get("/internal/ai-usage")
    assert response.status_code == 200, response.text
    rows = {row["organization_id"]: row for row in response.json()}
    a = rows[str(admin_case["org_a"])]
    b = rows[str(admin_case["org_b"])]
    assert (a["calls"], a["successes"], a["failures"], a["rate_limited"]) == (
        3, 1, 1, 1
    )
    assert (b["calls"], b["successes"], b["failures"], b["rate_limited"]) == (
        1, 1, 0, 0
    )
    organizations = await async_client.get("/internal/organizations")
    assert organizations.status_code == 200
    assert PRIVATE_PLAN_TEXT not in response.text
    assert PRIVATE_PLAN_TEXT not in organizations.text
    async with session_factory() as db:
        plan_task = await db.scalar(select(PlanTask).where(
            PlanTask.plan_id == admin_case["plan"]
        ))
        assert plan_task is not None and plan_task.text == PRIVATE_PLAN_TEXT
    as_user(async_client, admin_case["owner"], JWT_AUDIENCE_INTERNAL)
    assert (await async_client.get("/internal/ai-usage")).status_code == 403
    as_user(async_client, admin_case["owner"], JWT_AUDIENCE_APP)
    assert (await async_client.get("/internal/ai-usage")).status_code == 401
