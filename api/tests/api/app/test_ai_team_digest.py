import uuid
from datetime import UTC, date, datetime

import pytest
from pydantic_ai.exceptions import ModelHTTPError
from pydantic_ai.messages import ModelResponse, ToolCallPart, UserPromptPart
from pydantic_ai.models.function import FunctionModel
from sqlalchemy import select

from app.config import settings
from app.exceptions import APIException
from app.models import (
    AIUsage, Organization, OrganizationMembership, PlanTask, PlanTeam, Team,
    TeamMembership, User, WeeklyPlan,
)
from app.security import JWT_AUDIENCE_APP, generate_jwt_token
from app.services import ai
from app.services.ai import AIService, TeamDigest

MONDAY = date(2026, 10, 5)
HEADERS = {"origin": "http://localhost:3001"}


def url(org_id, team_id, monday=MONDAY):
    return f"/app/organizations/{org_id}/ai/teams/{team_id}/weeks/{monday}/digest"


def as_user(client, user_id):
    client.cookies.clear()
    client.cookies.set(
        "access_token",
        f"Bearer {generate_jwt_token({'sub': str(user_id)}, JWT_AUDIENCE_APP)}",
    )


def digest_model(output, calls=None, prompts=None):
    async def respond(messages, info):
        if calls is not None:
            calls.append("model")
        if prompts is not None:
            prompts.extend(part.content for message in messages for part in message.parts
                           if isinstance(part, UserPromptPart))
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, output)])

    return FunctionModel(respond)


def narrative(risk_ids=None):
    return {
        "progress_summary": "The team has recorded progress for this selected week.",
        "delivery_risk_ids": risk_ids or [],
        "recommended_actions": ["Review the recorded plan statuses with the team."],
    }


@pytest.fixture
async def digest_case(session_factory):
    async with session_factory() as db:
        suffix = uuid.uuid4().hex
        names = ("Lead", "Submitted", "Draft", "Approved", "Done", "Revoked",
                 "Inactive", "OtherLead", "Foreign")
        users = {}
        for name in names:
            user = User(first_name=name, last_name="Member",
                        email=f"{name.lower()}-{suffix}@test.dev", password=None,
                        is_active=name != "Inactive", is_admin=False)
            db.add(user)
            users[name] = user
        await db.flush()
        org = Organization(name="Digest", slug=f"digest-{suffix}")
        foreign_org = Organization(name="Foreign Digest", slug=f"foreign-digest-{suffix}")
        db.add_all([org, foreign_org])
        await db.flush()
        members = {}
        for name in names:
            member = OrganizationMembership(
                organization_id=foreign_org.id if name == "Foreign" else org.id,
                user_id=users[name].id,
                role="owner" if name == "OtherLead" else "member",
                revoked_at=datetime.now(UTC) if name == "Revoked" else None,
            )
            db.add(member)
            members[name] = member
        await db.flush()
        team = Team(organization_id=org.id, name="Engineering")
        other_team = Team(organization_id=org.id, name="Design")
        foreign_team = Team(organization_id=foreign_org.id, name="Engineering")
        db.add_all([team, other_team, foreign_team])
        await db.flush()
        for name in names[:-2]:
            db.add(TeamMembership(organization_id=org.id, team_id=team.id,
                                  membership_id=members[name].id,
                                  is_lead=name == "Lead", is_primary=True))
        db.add(TeamMembership(organization_id=org.id, team_id=other_team.id,
                              membership_id=members["OtherLead"].id, is_lead=True))
        db.add(TeamMembership(organization_id=foreign_org.id, team_id=foreign_team.id,
                              membership_id=members["Foreign"].id, is_lead=True))
        await db.flush()
        plans = {}
        tasks = {}
        for name, status, shipped, done in (
            ("Submitted", "submitted", None, False),
            ("Draft", "draft", None, False),
            ("Approved", "approved", None, False),
            ("Done", "done", False, True),
            ("Revoked", "submitted", None, False),
            ("Inactive", "submitted", None, False),
        ):
            plan = WeeklyPlan(organization_id=org.id,
                              author_membership_id=members[name].id,
                              primary_team_id=team.id, week_start=MONDAY,
                              status=status, main_shipped=shipped)
            db.add(plan)
            await db.flush()
            db.add(PlanTeam(organization_id=org.id, plan_id=plan.id, team_id=team.id))
            task = PlanTask(organization_id=org.id, plan_id=plan.id, kind="main",
                            text=f"Deliver {name.lower()} milestone", position=0,
                            is_done=done)
            db.add(task)
            plans[name] = plan
            tasks[name] = task
        # A foreign team plan and an unrelated team plan must never enter this snapshot.
        for name, selected_org, selected_team in (
            ("Foreign", foreign_org, foreign_team),
            ("OtherLead", org, other_team),
        ):
            plan = WeeklyPlan(organization_id=selected_org.id,
                              author_membership_id=members[name].id,
                              primary_team_id=selected_team.id, week_start=MONDAY,
                              status="done", main_shipped=True)
            db.add(plan)
            await db.flush()
            db.add(PlanTeam(organization_id=selected_org.id,
                            plan_id=plan.id, team_id=selected_team.id))
            db.add(PlanTask(organization_id=selected_org.id, plan_id=plan.id,
                            kind="main", text=f"Private {name.lower()} deliverable",
                            position=0, is_done=True))
        await db.commit()
        yield {"db": db, "org": org.id, "foreign_org": foreign_org.id,
               "team": team.id, "other_team": other_team.id,
               "foreign_team": foreign_team.id, "users": {k: v.id for k, v in users.items()},
               "members": {k: v.id for k, v in members.items()},
               "plans": {k: v.id for k, v in plans.items()},
               "tasks": {k: v.id for k, v in tasks.items()}}


@pytest.mark.asyncio
async def test_digest_counts_current_members_and_distinguishes_workflow_states(digest_case):
    case = digest_case
    prompts = []
    before = {name: ((await case["db"].get(WeeklyPlan, plan_id)).status,
                     (await case["db"].get(WeeklyPlan, plan_id)).main_shipped)
              for name, plan_id in case["plans"].items()}
    digest = await AIService(case["db"], case["org"], case["members"]["Lead"],
                             model=digest_model(narrative(), prompts=prompts)).team_digest(
                                 case["team"], MONDAY)
    await case["db"].commit()
    assert isinstance(digest, TeamDigest)
    assert digest.member_count == 5
    assert digest.submitted_count == 3  # submitted, approved and done; never draft
    assert (digest.draft_count, digest.not_started_count) == (1, 1)
    assert (digest.awaiting_approval_count, digest.approved_count, digest.done_count) == (1, 1, 1)
    assert {item.name for item in digest.missing_submissions} == {"Lead Member", "Draft Member"}
    assert {item.name for item in digest.members}.isdisjoint({
        "Revoked Member", "Inactive Member", "OtherLead Member", "Foreign Member",
    })
    by_name = {item.name: item for item in digest.members}
    assert by_name["Approved Member"].tasks_done == 0
    assert by_name["Done Member"].tasks_done == 1
    assert by_name["Done Member"].main_shipped is False
    assert by_name["Lead Member"].status == "not_started"
    assert {risk.kind for risk in digest.incomplete_work} == {
        "incomplete_task", "unshipped_main_goal",
    }
    assert {risk.task_id for risk in digest.incomplete_work if risk.task_id} == {
        case["tasks"]["Approved"],
    }
    assert prompts and "Private foreign deliverable" not in str(prompts)
    assert "Deliver revoked milestone" not in str(prompts)
    assert "Deliver inactive milestone" not in str(prompts)
    assert {name: ((await case["db"].get(WeeklyPlan, plan_id)).status,
                   (await case["db"].get(WeeklyPlan, plan_id)).main_shipped)
            for name, plan_id in case["plans"].items()} == before
    assert (await case["db"].get(PlanTask, case["tasks"]["Approved"])).is_done is False
    assert (await case["db"].get(PlanTask, case["tasks"]["Done"])).is_done is True
    usages = (await case["db"].scalars(select(AIUsage).where(
        AIUsage.organization_id == case["org"], AIUsage.feature == "team_digest"))).all()
    assert len(usages) == 1 and usages[0].outcome == "success"
    assert usages[0].actor_membership_id == case["members"]["Lead"]


@pytest.mark.asyncio
async def test_digest_risks_are_backed_by_authorized_task_and_shipped_evidence(digest_case):
    case = digest_case
    # Risk IDs follow active member order: Approved's incomplete task is evidence-1,
    # Done's unshipped main goal is evidence-2, Draft is evidence-3, Lead is evidence-4.
    digest = await AIService(
        case["db"], case["org"], case["members"]["Lead"],
        model=digest_model(narrative(["evidence-1", "evidence-2"])),
    ).team_digest(case["team"], MONDAY)
    assert [(risk.kind, risk.task_id) for risk in digest.delivery_risks] == [
        ("incomplete_task", case["tasks"]["Approved"]),
        ("unshipped_main_goal", None),
    ]
    assert digest.delivery_risks[0].plan_id == case["plans"]["Approved"]
    assert digest.delivery_risks[1].plan_id == case["plans"]["Done"]
    assert all(risk.member_id in {member.member_id for member in digest.members}
               for risk in digest.delivery_risks)


@pytest.mark.asyncio
@pytest.mark.parametrize("risk_ids", [["invented"], ["evidence-1", "evidence-1"]])
async def test_invented_or_duplicate_risk_reference_is_rejected_and_recorded(
    digest_case, risk_ids,
):
    case = digest_case
    with pytest.raises(APIException) as error:
        await AIService(case["db"], case["org"], case["members"]["Lead"],
                        model=digest_model(narrative(risk_ids))).team_digest(case["team"], MONDAY)
    assert error.value.code == "AI_INVALID_OUTPUT"
    usage = await case["db"].scalar(select(AIUsage).where(
        AIUsage.organization_id == case["org"], AIUsage.feature == "team_digest"))
    assert usage.outcome == "invalid_output"


@pytest.mark.asyncio
async def test_no_submissions_returns_factual_missing_members_and_no_fabricated_risk(digest_case):
    case = digest_case
    for name in ("Submitted", "Approved", "Done"):
        plan = await case["db"].get(WeeklyPlan, case["plans"][name])
        plan.status = "draft"
    await case["db"].flush()
    digest = await AIService(case["db"], case["org"], case["members"]["Lead"],
                             model=digest_model(narrative())).team_digest(case["team"], MONDAY)
    assert digest.submitted_count == 0
    assert digest.draft_count == 4 and digest.not_started_count == 1
    assert len(digest.missing_submissions) == 5
    assert digest.delivery_risks == []


@pytest.mark.asyncio
async def test_all_current_members_submitted_excludes_drafts_from_missing(digest_case):
    case = digest_case
    lead_plan = WeeklyPlan(
        organization_id=case["org"], author_membership_id=case["members"]["Lead"],
        primary_team_id=case["team"], week_start=MONDAY, status="submitted",
    )
    case["db"].add(lead_plan)
    await case["db"].flush()
    case["db"].add(PlanTeam(organization_id=case["org"],
                             plan_id=lead_plan.id, team_id=case["team"]))
    draft = await case["db"].get(WeeklyPlan, case["plans"]["Draft"])
    draft.status = "submitted"
    await case["db"].flush()
    digest = await AIService(case["db"], case["org"], case["members"]["Lead"],
                             model=digest_model(narrative())).team_digest(case["team"], MONDAY)
    assert digest.member_count == digest.submitted_count == 5
    assert digest.draft_count == digest.not_started_count == 0
    assert digest.missing_submissions == []
    assert digest.awaiting_approval_count == 3


@pytest.mark.asyncio
async def test_new_team_with_only_its_lead_and_no_plan_is_safe(digest_case):
    case = digest_case
    team = Team(organization_id=case["org"], name="New Team")
    case["db"].add(team)
    await case["db"].flush()
    case["db"].add(TeamMembership(
        organization_id=case["org"], team_id=team.id,
        membership_id=case["members"]["Lead"], is_lead=True,
    ))
    await case["db"].flush()
    digest = await AIService(case["db"], case["org"], case["members"]["Lead"],
                             model=digest_model(narrative())).team_digest(team.id, MONDAY)
    assert digest.member_count == 1
    assert digest.submitted_count == 0
    assert digest.not_started_count == 1
    assert [item.member_id for item in digest.missing_submissions] == [case["members"]["Lead"]]


@pytest.mark.asyncio
async def test_endpoint_enforces_lead_team_org_and_current_membership_before_model(
    async_client, session_factory, digest_case, monkeypatch,
):
    case = digest_case
    calls = []
    monkeypatch.setattr(ai, "GoogleModel", lambda *args, **kwargs: calls.append("model"))
    async with session_factory() as db:
        baseline = set((await db.scalars(select(AIUsage.id))).all())
    response = await async_client.post(url(case["org"], case["team"]), headers=HEADERS)
    assert response.status_code == 401
    as_user(async_client, case["users"]["Draft"])
    response = await async_client.post(url(case["org"], case["team"]), headers=HEADERS)
    assert response.status_code == 404
    as_user(async_client, case["users"]["OtherLead"])
    response = await async_client.post(url(case["org"], case["team"]), headers=HEADERS)
    assert response.status_code == 404
    as_user(async_client, case["users"]["Lead"])
    for org, team in ((case["foreign_org"], case["foreign_team"]),
                      (case["org"], case["foreign_team"]),
                      (case["org"], case["other_team"])):
        response = await async_client.post(url(org, team), headers=HEADERS)
        assert response.status_code == 404
    as_user(async_client, case["users"]["Revoked"])
    assert (await async_client.post(url(case["org"], case["team"]),
                                    headers=HEADERS)).status_code == 404
    as_user(async_client, case["users"]["Inactive"])
    assert (await async_client.post(url(case["org"], case["team"]),
                                    headers=HEADERS)).status_code == 401
    as_user(async_client, case["users"]["Lead"])
    assert (await async_client.post(url(case["org"], case["team"], date(2026, 10, 6)),
                                    headers=HEADERS)).status_code == 400
    async with session_factory() as db:
        org = await db.get(Organization, case["org"])
        org.suspended_at = datetime.now(UTC)
        await db.commit()
    assert (await async_client.post(url(case["org"], case["team"]),
                                    headers=HEADERS)).status_code == 404
    assert calls == []
    async with session_factory() as db:
        assert set((await db.scalars(select(AIUsage.id))).all()) == baseline


@pytest.mark.asyncio
async def test_authorized_endpoint_returns_typed_digest_without_google(
    async_client, session_factory, digest_case, monkeypatch,
):
    case = digest_case
    calls = []
    fake_model = digest_model(narrative(["evidence-1"]), calls=calls)
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", "offline-test-key")
    monkeypatch.setattr(ai, "GoogleProvider", lambda *, api_key: object())
    monkeypatch.setattr(ai, "GoogleModel", lambda name, *, provider: fake_model)
    as_user(async_client, case["users"]["Lead"])
    response = await async_client.post(url(case["org"], case["team"]), headers=HEADERS)
    assert response.status_code == 200
    body = response.json()
    assert body["team_id"] == str(case["team"])
    assert body["week_start"] == MONDAY.isoformat()
    assert body["member_count"] == 5 and body["submitted_count"] == 3
    assert len(body["incomplete_work"]) == 2
    assert body["delivery_risks"][0]["task_id"] == str(case["tasks"]["Approved"])
    assert calls == ["model"]
    async with session_factory() as db:
        usage = await db.scalar(select(AIUsage).where(
            AIUsage.organization_id == case["org"], AIUsage.feature == "team_digest"))
        assert usage.outcome == "success"
        assert usage.actor_membership_id == case["members"]["Lead"]


@pytest.mark.asyncio
async def test_missing_key_invalid_typed_output_and_provider_failures_record_usage(
    digest_case, monkeypatch,
):
    case = digest_case
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", None)
    with pytest.raises(APIException) as missing:
        await AIService(case["db"], case["org"], case["members"]["Lead"]).team_digest(
            case["team"], MONDAY)
    assert missing.value.status_code == 503
    with pytest.raises(APIException) as invalid:
        await AIService(case["db"], case["org"], case["members"]["Lead"],
                        model=digest_model({"progress_summary": "x", "delivery_risk_ids": [],
                                            "recommended_actions": []})).team_digest(
                                                case["team"], MONDAY)
    assert invalid.value.code == "AI_INVALID_OUTPUT"

    async def rate_limited(messages, info):
        raise ModelHTTPError(429, "gemini-3.5-flash-lite", body={"error": "private"})

    with pytest.raises(APIException) as limited:
        await AIService(case["db"], case["org"], case["members"]["Lead"],
                        model=FunctionModel(rate_limited)).team_digest(case["team"], MONDAY)
    assert limited.value.status_code == 429 and "private" not in limited.value.message

    async def provider_failure(messages, info):
        raise RuntimeError("private provider detail")

    with pytest.raises(APIException) as failed:
        await AIService(case["db"], case["org"], case["members"]["Lead"],
                        model=FunctionModel(provider_failure)).team_digest(case["team"], MONDAY)
    assert failed.value.status_code == 503 and "private" not in failed.value.message
    await case["db"].commit()
    usages = (await case["db"].scalars(select(AIUsage).where(
        AIUsage.organization_id == case["org"], AIUsage.feature == "team_digest"))).all()
    assert {usage.outcome for usage in usages} == {
        "unavailable", "invalid_output", "rate_limited", "failure",
    }
    assert all(usage.actor_membership_id == case["members"]["Lead"] for usage in usages)
