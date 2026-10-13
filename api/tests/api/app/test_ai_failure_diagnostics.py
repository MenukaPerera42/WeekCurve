import asyncio
import uuid

import pytest
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


def failure_events(caplog):
    return [record.getMessage() for record in caplog.records
            if record.getMessage().startswith("ai_failure ")]


def test_untrusted_failure_metadata_is_not_logged(caplog):
    private_text = "private-provider-response"
    with caplog.at_level("WARNING", logger=ai.logger.name):
        ai.log_ai_failure(private_text, private_text, private_text, 12)

    assert failure_events(caplog) == [
        "ai_failure feature=unknown outcome=failure provider_status=None latency_ms=12"
    ]
    assert private_text not in failure_events(caplog)[0]


@pytest.mark.asyncio
async def test_missing_key_logs_unavailable_without_google(caplog, monkeypatch):
    monkeypatch.setattr(ai.settings, "GOOGLE_API_KEY", None)

    def forbid_google(*args, **kwargs):
        raise AssertionError("Google must not be called")

    monkeypatch.setattr(ai, "GoogleModel", forbid_google)
    session = RecordingSession()
    service = ai.AIService(session, uuid.uuid4(), uuid.uuid4())

    with (
        caplog.at_level("WARNING", logger=ai.logger.name),
        pytest.raises(APIException) as error,
    ):
        await service._run("brain_dump", ai.GeneratedPlan, "Instructions", "Prompt")

    assert error.value.status_code == 503
    assert error.value.code == "AI_UNAVAILABLE"
    assert len(session.usage) == 1 and session.usage[0].outcome == "unavailable"
    expected = ("ai_failure feature=brain_dump outcome=unavailable "
                f"provider_status=None latency_ms={session.usage[0].latency_ms}")
    assert failure_events(caplog) == [expected]


@pytest.mark.asyncio
@pytest.mark.parametrize("feature", [
    "brain_dump", "review", "look_back", "weekly_summary", "team_digest",
])
async def test_each_ai_feature_logs_one_sanitized_provider_failure(feature, caplog):
    private_text = "private-plan-text-and-provider-body"

    async def provider_failure(messages, info):
        raise ModelHTTPError(503, ai.MODEL, body={"error": private_text})

    session = RecordingSession()
    organization_id = uuid.uuid4()
    member_id = uuid.uuid4()
    service = ai.AIService(session, organization_id, member_id,
                           model=FunctionModel(provider_failure))

    with (
        caplog.at_level("WARNING", logger=ai.logger.name),
        pytest.raises(APIException) as error,
    ):
        await service._run(feature, ai.GeneratedPlan, "Private instructions",
                           private_text)

    assert error.value.status_code == 503
    assert error.value.code == "AI_UNAVAILABLE"
    assert len(session.usage) == 1
    usage = session.usage[0]
    assert (usage.feature, usage.outcome, usage.provider_status) == (
        feature, "failure", 503,
    )
    assert usage.organization_id == organization_id
    assert usage.actor_membership_id == member_id
    expected = (f"ai_failure feature={feature} outcome=failure "
                f"provider_status=503 latency_ms={usage.latency_ms}")
    assert failure_events(caplog) == [expected]
    assert all(private_text not in record.getMessage()
               and str(organization_id) not in record.getMessage()
               and str(member_id) not in record.getMessage()
               for record in caplog.records)


@pytest.mark.asyncio
async def test_timeout_logs_the_existing_outcome_and_error(caplog, monkeypatch):
    async def slow_provider(messages, info):
        await asyncio.sleep(0.1)

    monkeypatch.setattr(ai.settings, "AI_TIMEOUT_SECONDS", 0.01)
    session = RecordingSession()
    service = ai.AIService(session, uuid.uuid4(), uuid.uuid4(),
                           model=FunctionModel(slow_provider))

    with (
        caplog.at_level("WARNING", logger=ai.logger.name),
        pytest.raises(APIException) as error,
    ):
        await service._run("weekly_summary", ai.GeneratedPlan, "Instructions", "Prompt")

    assert error.value.status_code == 503
    assert error.value.code == "AI_TIMEOUT"
    assert len(session.usage) == 1 and session.usage[0].outcome == "timeout"
    expected = ("ai_failure feature=weekly_summary outcome=timeout "
                f"provider_status=None latency_ms={session.usage[0].latency_ms}")
    assert failure_events(caplog) == [expected]


@pytest.mark.asyncio
async def test_rate_limit_logs_provider_status_without_response_body(caplog):
    private_text = "private-rate-limit-response"

    async def rate_limited(messages, info):
        raise ModelHTTPError(429, ai.MODEL, body={"error": private_text})

    session = RecordingSession()
    service = ai.AIService(session, uuid.uuid4(), uuid.uuid4(),
                           model=FunctionModel(rate_limited))

    with (
        caplog.at_level("WARNING", logger=ai.logger.name),
        pytest.raises(APIException) as error,
    ):
        await service._run("team_digest", ai.GeneratedPlan, "Instructions", "Prompt")

    assert error.value.status_code == 429
    assert error.value.code == "AI_UNAVAILABLE"
    assert len(session.usage) == 1
    assert session.usage[0].outcome == "rate_limited"
    assert session.usage[0].provider_status == 429
    expected = ("ai_failure feature=team_digest outcome=rate_limited "
                f"provider_status=429 latency_ms={session.usage[0].latency_ms}")
    assert failure_events(caplog) == [expected]
    assert all(private_text not in record.getMessage() for record in caplog.records)


@pytest.mark.asyncio
async def test_structured_output_retry_exhaustion_logs_invalid_output(caplog):
    calls = 0

    async def malformed_output(messages, info):
        nonlocal calls
        calls += 1
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, {})])

    session = RecordingSession()
    service = ai.AIService(session, uuid.uuid4(), uuid.uuid4(),
                           model=FunctionModel(malformed_output))

    with (
        caplog.at_level("WARNING", logger=ai.logger.name),
        pytest.raises(APIException) as error,
    ):
        await service._run("review", ai.InternalPlanReview, "Instructions", "Prompt")

    assert calls == 3  # One initial attempt and the existing two output retries.
    assert error.value.status_code == 503
    assert error.value.code == "AI_INVALID_OUTPUT"
    assert len(session.usage) == 1 and session.usage[0].outcome == "invalid_output"
    expected = ("ai_failure feature=review outcome=invalid_output "
                f"provider_status=None latency_ms={session.usage[0].latency_ms}")
    assert failure_events(caplog) == [expected]


@pytest.mark.asyncio
async def test_post_run_draft_validation_logs_invalid_output(caplog):
    async def invalid_draft(messages, info):
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, {
            "tasks": [{"kind": "sub_goal", "text": "Tests pass on staging"}],
        })])

    session = RecordingSession()
    service = ai.AIService(session, uuid.uuid4(), uuid.uuid4(),
                           model=FunctionModel(invalid_draft))

    with (
        caplog.at_level("WARNING", logger=ai.logger.name),
        pytest.raises(APIException) as error,
    ):
        await service.generate("Write tests and verify them on staging this week.")

    assert error.value.status_code == 503
    assert error.value.code == "AI_INVALID_OUTPUT"
    assert len(session.usage) == 1 and session.usage[0].outcome == "invalid_output"
    assert len(failure_events(caplog)) == 1
    assert failure_events(caplog)[0].startswith(
        "ai_failure feature=brain_dump outcome=invalid_output provider_status=None "
    )


@pytest.mark.asyncio
async def test_logging_failure_does_not_mask_provider_error(monkeypatch):
    async def provider_failure(messages, info):
        raise ModelHTTPError(503, ai.MODEL, body={"error": "private-response"})

    def broken_logger(*args, **kwargs):
        raise RuntimeError("logging failed")

    monkeypatch.setattr(ai.logger, "warning", broken_logger)
    session = RecordingSession()
    service = ai.AIService(session, uuid.uuid4(), uuid.uuid4(),
                           model=FunctionModel(provider_failure))

    with pytest.raises(APIException) as error:
        await service._run("weekly_summary", ai.GeneratedPlan, "Instructions", "Prompt")

    assert error.value.status_code == 503
    assert error.value.code == "AI_UNAVAILABLE"
    assert len(session.usage) == 1
    assert session.usage[0].outcome == "failure"
    assert session.usage[0].provider_status == 503
