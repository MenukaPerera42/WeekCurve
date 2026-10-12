from datetime import date
from uuid import NAMESPACE_URL, UUID, uuid5

import pytest
from sqlalchemy import func, select

from app.models import (
    Organization,
    OrganizationMembership,
    PlanEvent,
    PlanTask,
    PlanTeam,
    Team,
    TeamMembership,
    User,
    WeeklyPlan,
)
from app.security import JWT_AUDIENCE_APP, generate_jwt_token, hash_password

MONDAY = date(2026, 10, 5)
PAST_MONDAY = date(2026, 9, 28)
ORIGIN = {"origin": "http://localhost:3001"}


def as_user(client, user_id):
    client.cookies.clear()
    client.cookies.set(
        "access_token",
        f"Bearer {generate_jwt_token({'sub': str(user_id)}, JWT_AUDIENCE_APP)}",
    )


def tasks(main_why="Customers can recover", main_text="Checkout recovers expired cards"):
    return {"tasks": [
        {"kind": "main", "text": main_text, "why_it_matters": main_why},
        {"kind": "sub_goal", "text": "Expired-card tests pass on staging"},
        {"kind": "go_to_market", "text": "Changelog entry is published"},
    ]}


@pytest.fixture
async def workflow(session_factory, request):
    # Stable identities avoid dependence on the date or development database.
    suffix = uuid5(NAMESPACE_URL, request.node.name).hex
    async with session_factory() as db:
        author = User(
            first_name="Maya", last_name="Member",
            email=f"plan-author-{suffix}@test.dev",
            password=hash_password("long-test-password"), is_active=True,
            is_admin=False,
        )
        lead = User(
            first_name="Leo", last_name="Lead",
            email=f"plan-lead-{suffix}@test.dev",
            password=hash_password("long-test-password"), is_active=True,
            is_admin=False,
        )
        db.add_all([author, lead])
        await db.flush()
        org = Organization(name="Planning Test", slug=f"planning-{suffix}")
        db.add(org)
        await db.flush()
        author_member = OrganizationMembership(
            organization_id=org.id, user_id=author.id, role="member"
        )
        lead_member = OrganizationMembership(
            organization_id=org.id, user_id=lead.id, role="member"
        )
        db.add_all([author_member, lead_member])
        await db.flush()
        team = Team(organization_id=org.id, name="Engineering")
        db.add(team)
        await db.flush()
        db.add_all([
            TeamMembership(
                organization_id=org.id, team_id=team.id,
                membership_id=author_member.id, is_primary=True, is_lead=False,
            ),
            TeamMembership(
                organization_id=org.id, team_id=team.id,
                membership_id=lead_member.id, is_primary=True, is_lead=True,
            ),
        ])
        await db.commit()
        return {
            "org": org.id, "team": team.id, "author": author.id,
            "author_member": author_member.id, "lead": lead.id,
        }


async def save(client, org_id, week=MONDAY, payload=None):
    response = await client.put(
        f"/app/organizations/{org_id}/plans/weeks/{week.isoformat()}",
        headers=ORIGIN, json=payload or tasks(),
    )
    assert response.status_code == 200, response.text
    return response.json()


async def submit(client, org_id, plan_id):
    response = await client.post(
        f"/app/organizations/{org_id}/plans/{plan_id}/submit", headers=ORIGIN
    )
    assert response.status_code == 200, response.text
    return response.json()


async def approve(client, org_id, plan_id):
    response = await client.post(
        f"/app/organizations/{org_id}/plans/{plan_id}/approve",
        headers=ORIGIN, json={},
    )
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.asyncio
async def test_monday_validation_main_structure_and_one_member_week(
    async_client, session_factory, workflow
):
    org_id = workflow["org"]
    as_user(async_client, workflow["author"])
    sunday = await async_client.put(
        f"/app/organizations/{org_id}/plans/weeks/2026-10-04",
        headers=ORIGIN, json=tasks(),
    )
    assert sunday.status_code == 400
    two_main = await async_client.put(
        f"/app/organizations/{org_id}/plans/weeks/{MONDAY}",
        headers=ORIGIN,
        json={"tasks": [tasks()["tasks"][0], tasks()["tasks"][0]]},
    )
    assert two_main.status_code == 400
    draft = await save(async_client, org_id, payload=tasks(main_why=""))
    assert draft["week_start"] == MONDAY.isoformat()
    assert draft["status"] == "draft"
    missing_why = await async_client.post(
        f"/app/organizations/{org_id}/plans/{draft['id']}/submit",
        headers=ORIGIN,
    )
    assert missing_why.status_code == 400
    revised = await save(async_client, org_id)
    assert revised["id"] == draft["id"]
    assert revised["tasks"][0]["why_it_matters"] == "Customers can recover"
    async with session_factory() as db:
        plans = (await db.scalars(select(WeeklyPlan).where(
            WeeklyPlan.organization_id == org_id,
            WeeklyPlan.author_membership_id == workflow["author_member"],
            WeeklyPlan.week_start == MONDAY,
        ))).all()
        assert len(plans) == 1
        assert plans[0].status == "draft"


@pytest.mark.asyncio
async def test_missing_go_to_market_blocks_submission_but_allows_draft_and_revision(
    async_client, session_factory, workflow
):
    org_id = workflow["org"]
    as_user(async_client, workflow["author"])
    incomplete = {"tasks": tasks()["tasks"][:2]}
    draft = await save(async_client, org_id, payload=incomplete)
    assert draft["status"] == "draft"
    assert len(draft["tasks"]) == 2

    rejected = await async_client.post(
        f"/app/organizations/{org_id}/plans/{draft['id']}/submit",
        headers=ORIGIN,
    )
    assert rejected.status_code == 400
    assert "go-to-market" in rejected.text.lower()
    async with session_factory() as db:
        plan = await db.get(WeeklyPlan, UUID(draft["id"]))
        assert plan is not None and plan.status == "draft"
        assert plan.submitted_at is None
        submitted_events = await db.scalar(select(func.count()).select_from(PlanEvent).where(
            PlanEvent.plan_id == UUID(draft["id"]), PlanEvent.action == "submitted",
        ))
        assert submitted_events == 0

    revised = await save(async_client, org_id)
    assert revised["id"] == draft["id"]
    assert any(task["kind"] == "go_to_market" for task in revised["tasks"])
    submitted = await submit(async_client, org_id, draft["id"])
    assert submitted["status"] == "submitted"
    async with session_factory() as db:
        plan = await db.get(WeeklyPlan, UUID(draft["id"]))
        assert plan is not None and plan.status == "submitted"
        assert plan.submitted_at is not None


@pytest.mark.asyncio
async def test_blank_go_to_market_text_is_rejected_by_request_validation(
    async_client, session_factory, workflow
):
    org_id = workflow["org"]
    as_user(async_client, workflow["author"])
    payload = tasks()
    payload["tasks"][2]["text"] = "   "
    rejected = await async_client.put(
        f"/app/organizations/{org_id}/plans/weeks/{MONDAY.isoformat()}",
        headers=ORIGIN, json=payload,
    )
    assert rejected.status_code == 422
    assert any(
        error["loc"] == ["body", "tasks", 2, "text"]
        and error["type"] == "string_too_short"
        for error in rejected.json()["detail"]
    )
    async with session_factory() as db:
        plan_count = await db.scalar(select(func.count()).select_from(WeeklyPlan).where(
            WeeklyPlan.organization_id == org_id,
            WeeklyPlan.author_membership_id == workflow["author_member"],
            WeeklyPlan.week_start == MONDAY,
        ))
        assert plan_count == 0


@pytest.mark.asyncio
async def test_submission_approval_and_invalid_transitions(
    async_client, session_factory, workflow
):
    org_id = workflow["org"]
    as_user(async_client, workflow["author"])
    draft = await save(async_client, org_id)
    plan_id = draft["id"]
    as_user(async_client, workflow["lead"])
    early_approval = await async_client.post(
        f"/app/organizations/{org_id}/plans/{plan_id}/approve",
        headers=ORIGIN, json={},
    )
    assert early_approval.status_code == 409
    as_user(async_client, workflow["author"])
    submitted = await submit(async_client, org_id, plan_id)
    assert submitted["status"] == "submitted"
    repeat_submit = await async_client.post(
        f"/app/organizations/{org_id}/plans/{plan_id}/submit", headers=ORIGIN
    )
    edit_submitted = await async_client.put(
        f"/app/organizations/{org_id}/plans/weeks/{MONDAY}",
        headers=ORIGIN, json=tasks(main_text="Changed after submission"),
    )
    assert repeat_submit.status_code == 409
    assert edit_submitted.status_code == 409
    as_user(async_client, workflow["lead"])
    approved = await approve(async_client, org_id, plan_id)
    assert approved["status"] == "approved"
    repeat_approval = await async_client.post(
        f"/app/organizations/{org_id}/plans/{plan_id}/approve",
        headers=ORIGIN, json={},
    )
    assert repeat_approval.status_code == 409
    async with session_factory() as db:
        plan = await db.get(WeeklyPlan, UUID(plan_id))
        assert plan is not None and plan.status == "approved"
        assert plan.submitted_at is not None
        assert plan.approved_at is not None


@pytest.mark.asyncio
async def test_send_back_comment_survives_member_revision(
    async_client, session_factory, workflow
):
    org_id = workflow["org"]
    as_user(async_client, workflow["author"])
    draft = await save(async_client, org_id)
    plan_id = draft["id"]
    await submit(async_client, org_id, plan_id)
    as_user(async_client, workflow["lead"])
    no_feedback = await async_client.post(
        f"/app/organizations/{org_id}/plans/{plan_id}/send-back",
        headers=ORIGIN, json={},
    )
    assert no_feedback.status_code == 400
    sent_back = await async_client.post(
        f"/app/organizations/{org_id}/plans/{plan_id}/send-back",
        headers=ORIGIN, json={"comment": "Name the observable checkout outcome."},
    )
    assert sent_back.status_code == 200, sent_back.text
    assert sent_back.json()["status"] == "draft"
    as_user(async_client, workflow["author"])
    revised = await save(
        async_client, org_id,
        payload=tasks(main_text="Checkout handles expired cards on staging"),
    )
    assert revised["id"] == plan_id
    assert revised["tasks"][0]["text"] == "Checkout handles expired cards on staging"
    assert any(
        event["action"] == "sent_back"
        and event["comment"] == "Name the observable checkout outcome."
        for event in revised["events"]
    )
    resubmitted = await submit(async_client, org_id, plan_id)
    assert resubmitted["status"] == "submitted"
    async with session_factory() as db:
        events = (await db.scalars(select(PlanEvent).where(
            PlanEvent.plan_id == UUID(plan_id), PlanEvent.action == "sent_back"
        ))).all()
        assert len(events) == 1
        assert events[0].comment == "Name the observable checkout outcome."


@pytest.mark.asyncio
async def test_individual_completion_is_separate_from_shipped_result(
    async_client, session_factory, workflow
):
    org_id = workflow["org"]
    as_user(async_client, workflow["author"])
    draft = await save(async_client, org_id)
    plan_id = draft["id"]
    premature_task = await async_client.patch(
        f"/app/organizations/{org_id}/plans/{plan_id}/tasks/{draft['tasks'][0]['id']}",
        headers=ORIGIN, json={"is_done": True},
    )
    assert premature_task.status_code == 409
    await submit(async_client, org_id, plan_id)
    as_user(async_client, workflow["lead"])
    await approve(async_client, org_id, plan_id)
    as_user(async_client, workflow["author"])
    completed = await async_client.patch(
        f"/app/organizations/{org_id}/plans/{plan_id}/tasks/{draft['tasks'][0]['id']}",
        headers=ORIGIN, json={"is_done": True},
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["main_shipped"] is None
    assert completed.json()["tasks"][0]["is_done"] is True
    assert completed.json()["tasks"][1]["is_done"] is False
    finished = await async_client.post(
        f"/app/organizations/{org_id}/plans/{plan_id}/finish",
        headers=ORIGIN, json={"main_shipped": False},
    )
    assert finished.status_code == 200, finished.text
    assert finished.json()["status"] == "done"
    assert finished.json()["main_shipped"] is False
    assert finished.json()["tasks"][0]["is_done"] is True
    after_finish = await async_client.patch(
        f"/app/organizations/{org_id}/plans/{plan_id}/tasks/{draft['tasks'][1]['id']}",
        headers=ORIGIN, json={"is_done": True},
    )
    assert after_finish.status_code == 409
    async with session_factory() as db:
        plan = await db.get(WeeklyPlan, UUID(plan_id))
        plan_tasks = (await db.scalars(select(PlanTask).where(
            PlanTask.plan_id == UUID(plan_id)
        ).order_by(PlanTask.position))).all()
        assert plan is not None and plan.status == "done"
        assert plan.main_shipped is False and plan.completed_at is not None
        assert [task.is_done for task in plan_tasks] == [True, False, False]


@pytest.mark.asyncio
async def test_lead_sees_past_week_after_author_leaves_team(
    async_client, session_factory, workflow
):
    org_id = workflow["org"]
    team_id = workflow["team"]
    as_user(async_client, workflow["author"])
    draft = await save(async_client, org_id, week=PAST_MONDAY)
    await submit(async_client, org_id, draft["id"])
    as_user(async_client, workflow["lead"])
    await approve(async_client, org_id, draft["id"])
    async with session_factory() as db:
        former_team_member = await db.scalar(select(TeamMembership).where(
            TeamMembership.team_id == team_id,
            TeamMembership.membership_id == workflow["author_member"],
        ))
        assert former_team_member is not None
        await db.delete(former_team_member)
        await db.commit()

    historical = await async_client.get(
        f"/app/organizations/{org_id}/teams/{team_id}/weeks/{PAST_MONDAY}"
    )
    assert historical.status_code == 200, historical.text
    author_row = next(
        row for row in historical.json()
        if row["member_id"] == str(workflow["author_member"])
    )
    assert author_row["plan_id"] == draft["id"]
    assert author_row["status"] == "approved"
    assert author_row["tasks_total"] == 3
    current = await async_client.get(
        f"/app/organizations/{org_id}/teams/{team_id}/weeks/{MONDAY}"
    )
    assert current.status_code == 200
    assert all(
        row["member_id"] != str(workflow["author_member"])
        for row in current.json()
    )
    async with session_factory() as db:
        snapshot_count = await db.scalar(select(func.count()).select_from(PlanTeam).where(
            PlanTeam.plan_id == UUID(draft["id"]), PlanTeam.team_id == team_id,
        ))
        current_member_count = await db.scalar(
            select(func.count()).select_from(TeamMembership).where(
                TeamMembership.team_id == team_id,
                TeamMembership.membership_id == workflow["author_member"],
            )
        )
        assert snapshot_count == 1
        assert current_member_count == 0
