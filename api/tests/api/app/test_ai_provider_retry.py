import asyncio
import uuid
from datetime import date

import pytest
from pydantic_ai import RunContext
from pydantic_ai.exceptions import ModelHTTPError
from pydantic_ai.messages import ModelResponse, ToolCallPart
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


@pytest.mark.asyncio
@pytest.mark.parametrize("feature", [
    "brain_dump", "review", "weekly_summary", "team_digest",
])
async def test_transient_503_recovers_once_for_each_feature(feature, monkeypatch):
    attempts = 0
    monkeypatch.setattr(ai.random, "uniform", lambda low, high: 0)

    async def respond(messages, info):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise ModelHTTPError(503, ai.MODEL, body={"error": "private-provider-body"})
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, {
            "tasks": [{"kind": "main", "text": "Checkout works on staging"}],
        })])

    service, session = service_with_model(respond)
    result = await service._run(feature, ai.GeneratedPlan, "Instructions", "Prompt")

    assert attempts == 2
    assert result.tasks[0].text == "Checkout works on staging"
    assert len(session.usage) == 1
    assert session.usage[0].feature == feature
    assert session.usage[0].outcome == "success"
    assert session.usage[0].provider_status is None


@pytest.mark.asyncio
async def test_look_back_retries_503_and_still_calls_history_tool(monkeypatch):
    attempts = 0
    monkeypatch.setattr(ai.random, "uniform", lambda low, high: 0)

    async def history_tool(ctx: RunContext[ai.LookbackDeps]) -> list[ai.HistoricalPlan]:
        ctx.deps.tool_calls += 1
        ctx.deps.history = []
        return []

    async def respond(messages, info):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise ModelHTTPError(503, ai.MODEL, body={"error": "private"})
        if attempts == 2:
            return ModelResponse(parts=[ToolCallPart(info.function_tools[0].name, {})])
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, {
            "previous_weeks": [], "repeated_work": [], "planning_adjustments": [],
            "message": "No previous plans yet.",
        })])

    service, session = service_with_model(respond)
    deps = ai.LookbackDeps(session, service.organization_id, service.actor_membership_id,
                           date(2026, 10, 12))
    result = await service._run("look_back", ai.LookbackAdvice, "Instructions", "Prompt",
                                deps=deps, tool=history_tool)

    assert attempts == 3
    assert deps.tool_calls == 1
    assert result.previous_weeks == []
    assert len(session.usage) == 1
    assert session.usage[0].outcome == "success"


@pytest.mark.asyncio
async def test_two_503_retries_use_short_exponential_backoff(monkeypatch):
    attempts = 0
    delays = []

    async def record_sleep(seconds):
        delays.append(seconds)

    monkeypatch.setattr(ai.asyncio, "sleep", record_sleep)
    monkeypatch.setattr(ai.random, "uniform", lambda low, high: low)

    async def respond(messages, info):
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise ModelHTTPError(503, ai.MODEL, body={"error": "private"})
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, {
            "tasks": [{"kind": "main", "text": "Checkout works on staging"}],
        })])

    service, session = service_with_model(respond)
    result = await service._run("brain_dump", ai.GeneratedPlan, "Instructions", "Prompt")

    assert attempts == 3
    assert delays == [0.25, 0.5]
    assert result.tasks[0].text == "Checkout works on staging"
    assert len(session.usage) == 1
    assert session.usage[0].outcome == "success"


@pytest.mark.asyncio
async def test_persistent_503_stops_after_two_retries_and_logs_safely(caplog, monkeypatch):
    attempts = 0
    private_text = "private-provider-response-and-plan"
    monkeypatch.setattr(ai.random, "uniform", lambda low, high: 0)

    async def respond(messages, info):
        nonlocal attempts
        attempts += 1
        raise ModelHTTPError(503, ai.MODEL, body={"error": private_text})

    service, session = service_with_model(respond)
    with (
        caplog.at_level("WARNING", logger=ai.logger.name),
        pytest.raises(APIException) as error,
    ):
        await service._run("look_back", ai.GeneratedPlan, "Instructions", private_text)

    assert attempts == 3
    assert error.value.status_code == 503
    assert error.value.code == "AI_UNAVAILABLE"
    assert len(session.usage) == 1
    assert (session.usage[0].outcome, session.usage[0].provider_status) == (
        "failure", 503,
    )
    diagnostics = [record.getMessage() for record in caplog.records
                   if record.getMessage().startswith("ai_failure ")]
    assert len(diagnostics) == 1
    assert "outcome=failure provider_status=503" in diagnostics[0]
    assert all(private_text not in record.getMessage() for record in caplog.records)


@pytest.mark.asyncio
@pytest.mark.parametrize("provider_status", [401, 403, 429, 502, 504])
async def test_other_provider_statuses_are_not_retried(provider_status):
    attempts = 0

    async def respond(messages, info):
        nonlocal attempts
        attempts += 1
        raise ModelHTTPError(provider_status, ai.MODEL, body={"error": "private"})

    service, session = service_with_model(respond)
    with pytest.raises(APIException) as error:
        await service._run("weekly_summary", ai.GeneratedPlan, "Instructions", "Prompt")

    assert attempts == 1
    assert error.value.status_code == (429 if provider_status == 429 else 503)
    assert error.value.code == "AI_UNAVAILABLE"
    assert len(session.usage) == 1
    assert session.usage[0].provider_status == provider_status
    assert session.usage[0].outcome == (
        "rate_limited" if provider_status == 429 else "failure"
    )


@pytest.mark.asyncio
async def test_retry_delay_consumes_the_original_deadline(monkeypatch):
    attempts = 0
    monkeypatch.setattr(ai.settings, "AI_LOOKBACK_TIMEOUT_SECONDS", 0.01)
    monkeypatch.setattr(ai.random, "uniform", lambda low, high: 0.05)

    async def respond(messages, info):
        nonlocal attempts
        attempts += 1
        raise ModelHTTPError(503, ai.MODEL, body={"error": "private"})

    service, session = service_with_model(respond)
    with pytest.raises(APIException) as error:
        await service._run("look_back", ai.GeneratedPlan, "Instructions", "Prompt")

    assert attempts == 1
    assert error.value.status_code == 503
    assert error.value.code == "AI_TIMEOUT"
    assert len(session.usage) == 1
    assert session.usage[0].outcome == "timeout"


@pytest.mark.asyncio
async def test_second_attempt_cannot_exceed_total_deadline(monkeypatch):
    attempts = 0
    monkeypatch.setattr(ai.settings, "AI_WEEKLY_SUMMARY_TIMEOUT_SECONDS", 0.02)
    monkeypatch.setattr(ai.random, "uniform", lambda low, high: 0)

    async def respond(messages, info):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise ModelHTTPError(503, ai.MODEL, body={"error": "private"})
        await asyncio.sleep(0.1)

    service, session = service_with_model(respond)
    with pytest.raises(APIException) as error:
        await service._run("weekly_summary", ai.GeneratedPlan, "Instructions", "Prompt")

    assert attempts == 2
    assert error.value.status_code == 503
    assert error.value.code == "AI_TIMEOUT"
    assert len(session.usage) == 1
    assert session.usage[0].outcome == "timeout"
