from datetime import UTC, date, datetime
import uuid

import pytest
from pydantic_ai.exceptions import ModelHTTPError
from pydantic_ai.messages import ModelResponse, RetryPromptPart, ToolCallPart, ToolReturnPart
from pydantic_ai.models.function import FunctionModel
from sqlalchemy import func, select

from app.config import settings
from app.exceptions import APIException
from app.models import (
    AIUsage, Organization, OrganizationMembership, PlanTask, Team, User, WeeklyPlan,
)
from app.security import JWT_AUDIENCE_APP, generate_jwt_token
from app.services import ai
from app.services.ai import AIService, LookbackAdvice, LookbackDeps, previous_two_plans


def as_user(client, user_id):
    client.cookies.clear()
    client.cookies.set(
        "access_token",
        f"Bearer {generate_jwt_token({'sub': str(user_id)}, JWT_AUDIENCE_APP)}",
    )


def url(org_id, monday=date(2026, 10, 12)):
    return f"/app/organizations/{org_id}/ai/weeks/{monday}/look-back"


@pytest.fixture
async def lookback_case(session_factory):
    async with session_factory() as db:
        suffix = uuid.uuid4().hex
        owner = User(first_name="Own", last_name="Member", email=f"own-{suffix}@test.dev",
                     password=None, is_active=True, is_admin=False)
        other = User(first_name="Other", last_name="Member", email=f"other-{suffix}@test.dev",
                     password=None, is_active=True, is_admin=False)
        foreign = User(first_name="Foreign", last_name="Member", email=f"foreign-{suffix}@test.dev",
                       password=None, is_active=True, is_admin=False)
        db.add_all([owner, other, foreign])
        await db.flush()
        org = Organization(name="Lookback", slug=f"lookback-{suffix}")
        foreign_org = Organization(name="Foreign", slug=f"foreign-{suffix}")
        db.add_all([org, foreign_org])
        await db.flush()
        member = OrganizationMembership(organization_id=org.id, user_id=owner.id, role="member")
        other_member = OrganizationMembership(organization_id=org.id, user_id=other.id, role="member")
        foreign_member = OrganizationMembership(
            organization_id=foreign_org.id, user_id=foreign.id, role="member"
        )
        db.add_all([member, other_member, foreign_member])
        await db.flush()
        team = Team(organization_id=org.id, name="Engineering")
        foreign_team = Team(organization_id=foreign_org.id, name="Engineering")
        db.add_all([team, foreign_team])
        await db.flush()
        plans = {}
        for key, org_id, member_id, team_id, monday, done, shipped in [
            ("old", org.id, member.id, team.id, date(2026, 9, 21), False, False),
            ("previous", org.id, member.id, team.id, date(2026, 9, 28), False, False),
            ("latest", org.id, member.id, team.id, date(2026, 10, 5), False, None),
            ("selected", org.id, member.id, team.id, date(2026, 10, 12), True, True),
            ("future", org.id, member.id, team.id, date(2026, 10, 19), True, True),
            ("other", org.id, other_member.id, team.id, date(2026, 10, 5), False, False),
            ("foreign", foreign_org.id, foreign_member.id, foreign_team.id,
             date(2026, 10, 5), False, False),
        ]:
            plan = WeeklyPlan(organization_id=org_id, author_membership_id=member_id,
                              primary_team_id=team_id, week_start=monday,
                              status="done" if shipped is not None else "draft",
                              main_shipped=shipped)
            db.add(plan)
            await db.flush()
            task = PlanTask(organization_id=org_id, plan_id=plan.id, kind="main",
                            text=f"Deliver checkout {key}", position=0, is_done=done)
            db.add(task)
            await db.flush()
            plans[key] = (plan.id, task.id)
        await db.commit()
        yield {
            "db": db, "org": org.id, "foreign_org": foreign_org.id,
            "user": owner.id, "other_user": other.id, "member": member.id,
            "other_member": other_member.id, "plans": plans,
        }


def tool_model(output, calls):
    async def respond(messages, info):
        returned = [part for message in messages for part in message.parts
                    if isinstance(part, ToolReturnPart) and part.tool_name == "previous_two_plans"]
        if not returned:
            calls.append("tool")
            assert any(tool.name == "previous_two_plans" for tool in info.function_tools)
            return ModelResponse(parts=[ToolCallPart("previous_two_plans", {})])
        calls.append("output")
        assert len(returned) == 1
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, output)])

    return FunctionModel(respond)


def output_without_tool_model(output):
    async def respond(messages, info):
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, output)])

    return FunctionModel(respond)


def correcting_tool_model(first_output, corrected_output, calls, feedback):
    async def respond(messages, info):
        returned = [part for message in messages for part in message.parts
                    if isinstance(part, ToolReturnPart) and part.tool_name == "previous_two_plans"]
        if not returned:
            calls.append("tool")
            return ModelResponse(parts=[ToolCallPart("previous_two_plans", {})])
        if "first_output" not in calls:
            calls.append("first_output")
            return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, first_output)])
        retries = [part for message in messages for part in message.parts
                   if isinstance(part, RetryPromptPart)]
        feedback.extend(str(part.content) for part in retries)
        calls.append("corrected_output")
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, corrected_output)])

    return FunctionModel(respond)


def valid_output(case):
    latest_plan, latest_task = case["plans"]["latest"]
    previous_plan, previous_task = case["plans"]["previous"]
    return {
        "previous_weeks": ["2026-10-05", "2026-09-28"],
        "repeated_work": [{
            "description": "Checkout remains unfinished across both weeks",
            "evidence": [
                {"plan_id": str(latest_plan), "task_id": str(latest_task)},
                {"plan_id": str(previous_plan), "task_id": str(previous_task)},
            ],
            "suggested_adjustment": "Reduce checkout scope to one verifiable milestone",
        }],
        "planning_adjustments": ["Reserve time for the checkout milestone"],
        "message": "Two recent plans contain unfinished checkout work.",
    }


@pytest.mark.asyncio
async def test_tool_returns_only_own_previous_two_plans_in_descending_order(lookback_case):
    case = lookback_case
    deps = LookbackDeps(case["db"], case["org"], case["member"], date(2026, 10, 12))
    # A real Pydantic AI call below invokes the registered function tool.
    calls = []
    advice = await AIService(case["db"], case["org"], case["member"],
                             model=tool_model(valid_output(case), calls)).look_back(deps.selected_monday)
    await case["db"].commit()
    assert isinstance(advice, LookbackAdvice)
    assert calls == ["tool", "output"]
    assert advice.previous_weeks == [date(2026, 10, 5), date(2026, 9, 28)]
    assert {ref.task_id for ref in advice.repeated_work[0].evidence} == {
        case["plans"]["latest"][1], case["plans"]["previous"][1]
    }
    assert (await case["db"].scalar(select(AIUsage).where(
        AIUsage.organization_id == case["org"]))).outcome == "success"


@pytest.mark.asyncio
async def test_tool_history_preserves_task_and_shipped_facts(lookback_case):
    case = lookback_case
    class Context:
        deps = LookbackDeps(case["db"], case["org"], case["member"], date(2026, 10, 12))

    history = await previous_two_plans(Context())
    assert [plan.week_start for plan in history] == [date(2026, 10, 5), date(2026, 9, 28)]
    assert history[0].main_shipped is None
    assert history[1].main_shipped is False
    assert all(plan.tasks[0].kind == "main" and not plan.tasks[0].is_done for plan in history)
    assert all(plan.tasks[0].text.startswith("Deliver checkout") for plan in history)
    assert {plan.id for plan in history}.isdisjoint({
        case["plans"][key][0] for key in ("old", "selected", "future", "other", "foreign")
    })


@pytest.mark.asyncio
async def test_authenticated_endpoint_uses_member_context_and_records_usage(
    async_client, session_factory, lookback_case, monkeypatch,
):
    case = lookback_case
    calls = []
    model = tool_model(valid_output(case), calls)
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", "offline-test-key")
    monkeypatch.setattr("app.services.ai.GoogleProvider", lambda *, api_key: object())
    monkeypatch.setattr("app.services.ai.GoogleModel", lambda name, *, provider: model)
    as_user(async_client, case["user"])
    response = await async_client.post(url(case["org"]),
                                       headers={"origin": "http://localhost:3001"})
    assert response.status_code == 200
    assert response.json()["previous_weeks"] == ["2026-10-05", "2026-09-28"]
    assert calls == ["tool", "output"]
    async with session_factory() as db:
        rows = (await db.scalars(select(AIUsage).where(
            AIUsage.organization_id == case["org"]))).all()
        assert len(rows) == 1
        assert rows[0].actor_membership_id == case["member"]
        assert rows[0].feature == "look_back" and rows[0].outcome == "success"


@pytest.mark.asyncio
async def test_no_prior_history_returns_safe_typed_advice_without_saving(lookback_case):
    case = lookback_case
    before = await case["db"].scalar(select(func.count()).select_from(WeeklyPlan))
    calls = []
    output = {"previous_weeks": [], "repeated_work": [], "planning_adjustments": [],
              "message": "No earlier plans are available yet; start with this week's priorities."}
    advice = await AIService(case["db"], case["org"], case["member"],
                             model=tool_model(output, calls)).look_back(date(2026, 9, 14))
    await case["db"].commit()
    assert calls == ["tool", "output"]
    assert advice.previous_weeks == [] and advice.repeated_work == []
    assert "No earlier plans" in advice.message
    assert await case["db"].scalar(select(func.count()).select_from(WeeklyPlan)) == before
    assert (await case["db"].scalar(select(AIUsage).where(
        AIUsage.organization_id == case["org"]))).actor_membership_id == case["member"]


@pytest.mark.asyncio
async def test_invalid_historical_reference_is_rejected_and_recorded(lookback_case):
    case = lookback_case
    output = valid_output(case)
    output["repeated_work"][0]["evidence"][0]["task_id"] = str(case["plans"]["foreign"][1])
    with pytest.raises(APIException) as error:
        await AIService(case["db"], case["org"], case["member"],
                        model=tool_model(output, [])).look_back(date(2026, 10, 12))
    await case["db"].commit()
    assert error.value.code == "AI_INVALID_OUTPUT"
    usage = await case["db"].scalar(select(AIUsage).where(AIUsage.organization_id == case["org"]))
    assert usage.feature == "look_back" and usage.outcome == "invalid_output"


@pytest.mark.asyncio
async def test_one_invalid_reference_then_valid_correction_succeeds_without_saving(
    lookback_case,
):
    case = lookback_case
    invalid = valid_output(case)
    invalid["repeated_work"][0]["evidence"][0]["task_id"] = str(
        case["plans"]["foreign"][1]
    )
    before = await case["db"].scalar(select(func.count()).select_from(WeeklyPlan))
    calls, feedback = [], []
    advice = await AIService(
        case["db"], case["org"], case["member"],
        model=correcting_tool_model(invalid, valid_output(case), calls, feedback),
    ).look_back(date(2026, 10, 12))
    await case["db"].commit()

    assert calls == ["tool", "first_output", "corrected_output"]
    assert len(feedback) == 1
    assert "exact plan_id and task_id pairs" in feedback[0]
    assert str(case["plans"]["foreign"][1]) not in feedback[0]
    assert {reference.task_id for reference in advice.repeated_work[0].evidence} == {
        case["plans"]["latest"][1], case["plans"]["previous"][1]
    }
    assert await case["db"].scalar(select(func.count()).select_from(WeeklyPlan)) == before
    usage = await case["db"].scalar(select(AIUsage).where(
        AIUsage.organization_id == case["org"]
    ))
    assert usage.feature == "look_back" and usage.outcome == "success"


@pytest.mark.asyncio
async def test_persistently_invalid_evidence_stops_after_one_correction_attempt(
    lookback_case,
):
    case = lookback_case
    invalid = valid_output(case)
    invalid["repeated_work"][0]["evidence"][0]["task_id"] = str(
        case["plans"]["foreign"][1]
    )
    calls, feedback = [], []
    with pytest.raises(APIException) as error:
        await AIService(
            case["db"], case["org"], case["member"],
            model=correcting_tool_model(invalid, invalid, calls, feedback),
        ).look_back(date(2026, 10, 12))
    await case["db"].commit()

    assert calls == ["tool", "first_output", "corrected_output"]
    assert len(feedback) == 1
    assert error.value.status_code == 503
    assert error.value.code == "AI_INVALID_OUTPUT"
    assert error.value.message == "AI returned unusable advice. Try again later."
    usage = await case["db"].scalar(select(AIUsage).where(
        AIUsage.organization_id == case["org"]
    ))
    assert usage.feature == "look_back" and usage.outcome == "invalid_output"


@pytest.mark.asyncio
async def test_no_repeated_work_is_valid_with_two_historical_plans(lookback_case):
    case = lookback_case
    latest_task = await case["db"].get(PlanTask, case["plans"]["latest"][1])
    assert latest_task is not None
    latest_task.text = "Publish customer help center"
    await case["db"].flush()
    output = {
        "previous_weeks": ["2026-10-05", "2026-09-28"],
        "repeated_work": [],
        "planning_adjustments": ["Choose a realistic milestone for the coming week"],
        "message": "No repeated unfinished work is supported by these plans.",
    }
    advice = await AIService(
        case["db"], case["org"], case["member"],
        model=tool_model(output, []),
    ).look_back(date(2026, 10, 12))
    await case["db"].commit()

    assert advice.repeated_work == []
    assert advice.planning_adjustments == output["planning_adjustments"]
    usage = await case["db"].scalar(select(AIUsage).where(
        AIUsage.organization_id == case["org"]
    ))
    assert usage.feature == "look_back" and usage.outcome == "success"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("scenario", "reason", "tool_calls", "history_plans", "findings", "advice_items"),
    [
        ("tool_not_called", "tool_not_called", 0, 0, 1, 1),
        ("week_mismatch", "week_mismatch", 1, 2, 1, 1),
        ("unknown_task", "unknown_task_reference", 1, 2, 1, 1),
        ("completed_task", "completed_task_reference", 1, 2, 1, 1),
        ("single_plan_evidence", "single_plan_evidence", 1, 2, 1, 1),
        ("no_history_with_advice", "no_history_with_advice", 1, 0, 0, 1),
    ],
)
async def test_invalid_output_logs_only_sanitized_reason_and_counts(
    lookback_case, caplog, monkeypatch, scenario, reason, tool_calls,
    history_plans, findings, advice_items,
):
    case = lookback_case
    output = valid_output(case)
    monday = date(2026, 10, 12)
    if scenario == "tool_not_called":
        model = output_without_tool_model(output)
    else:
        if scenario == "week_mismatch":
            output["previous_weeks"].reverse()
        elif scenario == "unknown_task":
            output["repeated_work"][0]["evidence"][0]["task_id"] = str(
                case["plans"]["foreign"][1]
            )
        elif scenario == "completed_task":
            task = await case["db"].get(PlanTask, case["plans"]["latest"][1])
            assert task is not None
            task.is_done = True
            await case["db"].flush()
        elif scenario == "single_plan_evidence":
            output["repeated_work"][0]["evidence"][1] = dict(
                output["repeated_work"][0]["evidence"][0]
            )
        elif scenario == "no_history_with_advice":
            monday = date(2026, 9, 14)
            output = {
                "previous_weeks": [], "repeated_work": [],
                "planning_adjustments": ["Start with one small milestone"],
                "message": "No earlier plans are available yet.",
            }
        model = tool_model(output, [])

    def forbid_google(*args, **kwargs):
        raise AssertionError("Google must not be called by offline tests")

    monkeypatch.setattr(ai, "GoogleModel", forbid_google)
    with caplog.at_level("WARNING", logger=ai.logger.name):
        with pytest.raises(APIException) as error:
            await AIService(case["db"], case["org"], case["member"],
                            model=model).look_back(monday)
    await case["db"].commit()

    assert error.value.status_code == 503
    assert error.value.code == "AI_INVALID_OUTPUT"
    assert error.value.message == "AI returned unusable advice. Try again later."
    usage = await case["db"].scalar(select(AIUsage).where(
        AIUsage.organization_id == case["org"]
    ))
    assert usage.feature == "look_back" and usage.outcome == "invalid_output"

    events = [record.getMessage() for record in caplog.records
              if record.name == ai.logger.name
              and record.getMessage().startswith("look_back_validation_failure")]
    expected_event = (
        "look_back_validation_failure feature=look_back "
        f"reason={reason} tool_calls={tool_calls} history_plans={history_plans} "
        f"findings={findings} advice_items={advice_items}"
    )
    assert events == [expected_event, expected_event]
    for private_value in (
        str(case["org"]), str(case["member"]),
        *(str(identifier) for pair in case["plans"].values() for identifier in pair),
        "Deliver checkout", output["message"], "offline-test-key",
    ):
        assert all(private_value not in event for event in events)


@pytest.mark.asyncio
async def test_diagnostic_logging_failure_does_not_change_rejection(
    lookback_case, monkeypatch,
):
    case = lookback_case

    def broken_logger(*args, **kwargs):
        raise RuntimeError("logging unavailable")

    monkeypatch.setattr(ai.logger, "warning", broken_logger)
    with pytest.raises(APIException) as error:
        await AIService(case["db"], case["org"], case["member"],
                        model=output_without_tool_model(valid_output(case))).look_back(
                            date(2026, 10, 12)
                        )
    await case["db"].commit()
    assert error.value.code == "AI_INVALID_OUTPUT"
    assert error.value.message == "AI returned unusable advice. Try again later."
    usage = await case["db"].scalar(select(AIUsage).where(
        AIUsage.organization_id == case["org"]
    ))
    assert usage.outcome == "invalid_output"


@pytest.mark.asyncio
async def test_revoked_inactive_suspended_and_foreign_access_stop_before_model(
    async_client, session_factory, lookback_case, monkeypatch,
):
    case = lookback_case
    calls = []
    monkeypatch.setattr("app.services.ai.GoogleModel", lambda *args, **kwargs: calls.append("model"))
    as_user(async_client, case["user"])
    assert (await async_client.post(url(case["foreign_org"]),
        headers={"origin": "http://localhost:3001"})).status_code == 404
    async with session_factory() as db:
        member = await db.get(OrganizationMembership, case["member"])
        member.revoked_at = datetime.now(UTC)
        await db.commit()
    assert (await async_client.post(url(case["org"]),
        headers={"origin": "http://localhost:3001"})).status_code == 404
    async with session_factory() as db:
        member = await db.get(OrganizationMembership, case["member"])
        member.revoked_at = None
        user = await db.get(User, case["user"])
        user.is_active = False
        await db.commit()
    assert (await async_client.post(url(case["org"]),
        headers={"origin": "http://localhost:3001"})).status_code == 401
    async with session_factory() as db:
        user = await db.get(User, case["user"])
        user.is_active = True
        org = await db.get(Organization, case["org"])
        org.suspended_at = datetime.now(UTC)
        await db.commit()
    assert (await async_client.post(url(case["org"]),
        headers={"origin": "http://localhost:3001"})).status_code == 404
    assert calls == []
    async with session_factory() as db:
        assert await db.scalar(select(func.count()).select_from(AIUsage).where(
            AIUsage.organization_id == case["org"])) == 0


@pytest.mark.asyncio
async def test_non_monday_is_rejected_without_ai_usage(async_client, session_factory, lookback_case):
    case = lookback_case
    as_user(async_client, case["user"])
    response = await async_client.post(url(case["org"], date(2026, 10, 13)),
                                       headers={"origin": "http://localhost:3001"})
    assert response.status_code == 400
    async with session_factory() as db:
        assert await db.scalar(select(func.count()).select_from(AIUsage).where(
            AIUsage.organization_id == case["org"])) == 0


@pytest.mark.asyncio
async def test_missing_key_and_provider_error_are_sanitized_and_scoped(
    lookback_case, monkeypatch,
):
    case = lookback_case
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", None)
    with pytest.raises(APIException) as unavailable:
        await AIService(case["db"], case["org"], case["member"]).look_back(date(2026, 10, 12))
    assert unavailable.value.status_code == 503

    async def rate_limited(messages, info):
        raise ModelHTTPError(429, "gemini-3.5-flash-lite", body={"error": "private-provider-detail"})

    with pytest.raises(APIException) as limited:
        await AIService(case["db"], case["org"], case["member"],
                        model=FunctionModel(rate_limited)).look_back(date(2026, 10, 12))
    await case["db"].commit()
    assert limited.value.status_code == 429
    assert "private-provider-detail" not in limited.value.message
    rows = (await case["db"].scalars(select(AIUsage).where(
        AIUsage.organization_id == case["org"]).order_by(AIUsage.created_at))).all()
    assert len(rows) == 2
    assert {row.outcome for row in rows} == {"unavailable", "rate_limited"}
    assert all(row.actor_membership_id == case["member"] and row.feature == "look_back"
               for row in rows)
    assert next(row for row in rows if row.outcome == "rate_limited").provider_status == 429
