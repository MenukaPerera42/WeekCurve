import asyncio
import uuid
from datetime import date

import pytest
from pydantic_ai import RunContext
from pydantic_ai.exceptions import ModelHTTPError
from pydantic_ai.messages import ModelResponse, ToolCallPart, ToolReturnPart
from pydantic_ai.models.function import FunctionModel

from app.exceptions import APIException
from app.services import ai


class RecordingSession:
    def __init__(self):
        self.usage = []

    def add(self, value):
        self.usage.append(value)

    async def flush(self):
        pass


def service_with_model(respond):
    session = RecordingSession()
    service = ai.AIService(session, uuid.uuid4(), uuid.uuid4(),
                           model=FunctionModel(respond))
    return service, session


def draft_response(info):
    return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, {
        "tasks": [{"kind": "main", "text": "Deliver a tested checkout"}],
    })])


@pytest.mark.asyncio
@pytest.mark.parametrize("feature,setting_name", [
    ("look_back", "AI_LOOKBACK_TIMEOUT_SECONDS"),
    ("weekly_summary", "AI_WEEKLY_SUMMARY_TIMEOUT_SECONDS"),
])
async def test_long_feature_succeeds_after_base_deadline(feature, setting_name, monkeypatch):
    # Scaled deadlines keep this offline regression fast while crossing the old limit.
    monkeypatch.setattr(ai.settings, "AI_TIMEOUT_SECONDS", 0.02)
    monkeypatch.setattr(ai.settings, setting_name, 0.1)

    async def respond(messages, info):
        if feature == "look_back" and not any(
            isinstance(part, ToolReturnPart) for message in messages for part in message.parts
        ):
            return ModelResponse(parts=[ToolCallPart(info.function_tools[0].name, {})])
        await asyncio.sleep(0.03)
        if feature == "look_back":
            return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, {
                "previous_weeks": [], "repeated_work": [], "planning_adjustments": [],
                "message": "No previous plans yet.",
            })])
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, {
            "summary": "No work was completed this week.",
            "next_week_follow_up": None,
        })])

    service, session = service_with_model(respond)
    if feature == "look_back":
        deps = ai.LookbackDeps(session, service.organization_id, service.actor_membership_id,
                                date(2026, 10, 12))

        async def history_tool(ctx: RunContext[ai.LookbackDeps]):
            ctx.deps.tool_calls += 1
            ctx.deps.history = []
            return []

        result = await service._run(feature, ai.LookbackAdvice, "Instructions", "Prompt",
                                    deps=deps, tool=history_tool)
        assert result.previous_weeks == []
    else:
        result = await service._run(feature, ai.WeeklySummaryNarrative,
                                    "Instructions", "Prompt")
        assert result.summary == "No work was completed this week."

    assert len(session.usage) == 1 and session.usage[0].outcome == "success"
    assert service.last_timing.model_calls == (2 if feature == "look_back" else 1)


@pytest.mark.asyncio
@pytest.mark.parametrize("feature,setting_name", [
    ("look_back", "AI_LOOKBACK_TIMEOUT_SECONDS"),
    ("weekly_summary", "AI_WEEKLY_SUMMARY_TIMEOUT_SECONDS"),
])
async def test_long_feature_still_cancels_at_its_deadline(feature, setting_name, monkeypatch):
    monkeypatch.setattr(ai.settings, setting_name, 0.01)
    cancelled = False

    async def respond(messages, info):
        nonlocal cancelled
        try:
            await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            cancelled = True
            raise

    service, session = service_with_model(respond)
    with pytest.raises(APIException) as error:
        await service._run(feature, ai.GeneratedPlan, "Instructions", "Prompt")

    assert error.value.code == "AI_TIMEOUT"
    assert cancelled
    assert len(session.usage) == 1 and session.usage[0].outcome == "timeout"


@pytest.mark.asyncio
@pytest.mark.parametrize("feature", ["brain_dump", "review", "team_digest"])
async def test_other_ai_feature_keeps_base_deadline(feature, monkeypatch):
    monkeypatch.setattr(ai.settings, "AI_TIMEOUT_SECONDS", 0.01)
    monkeypatch.setattr(ai.settings, "AI_LOOKBACK_TIMEOUT_SECONDS", 0.05)
    monkeypatch.setattr(ai.settings, "AI_WEEKLY_SUMMARY_TIMEOUT_SECONDS", 0.05)

    async def respond(messages, info):
        await asyncio.sleep(0.03)
        return draft_response(info)

    service, session = service_with_model(respond)
    with pytest.raises(APIException) as error:
        await service._run(feature, ai.GeneratedPlan, "Instructions", "Prompt")

    assert error.value.code == "AI_TIMEOUT"
    assert len(session.usage) == 1 and session.usage[0].outcome == "timeout"


@pytest.mark.asyncio
@pytest.mark.parametrize("status,expected", [(503, "failure"), (429, "rate_limited")])
async def test_provider_errors_keep_existing_policy(status, expected, monkeypatch, caplog):
    monkeypatch.setattr(ai.random, "uniform", lambda low, high: 0)
    private_text = "private-provider-body"
    calls = 0

    async def respond(messages, info):
        nonlocal calls
        calls += 1
        raise ModelHTTPError(status, ai.MODEL, body={"error": private_text})

    service, session = service_with_model(respond)
    with (
        caplog.at_level("WARNING", logger=ai.logger.name),
        pytest.raises(APIException),
    ):
        await service._run("weekly_summary", ai.GeneratedPlan, "Instructions", private_text)

    assert calls == (3 if status == 503 else 1)
    assert len(session.usage) == 1
    assert session.usage[0].outcome == expected
    failures = [record.getMessage() for record in caplog.records
                if record.getMessage().startswith("ai_failure ")]
    assert len(failures) == 1
    assert private_text not in failures[0]
