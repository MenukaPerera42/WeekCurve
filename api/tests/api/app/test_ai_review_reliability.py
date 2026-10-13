import uuid

import pytest
from pydantic_ai.messages import ModelResponse, ToolCallPart
from pydantic_ai.models.function import FunctionModel
from pydantic_ai.models.test import TestModel

from app.exceptions import APIException
from app.services import ai


class RecordingSession:
    def __init__(self):
        self.usage = []

    def add(self, value):
        self.usage.append(value)

    async def flush(self):
        pass


TASKS = [
    ai.ReviewTask(id="main-1", kind="main", text="Checkout succeeds on staging",
                  why_it_matters="Customers can complete purchases"),
    ai.ReviewTask(id="sub-1", kind="sub_goal", text="Work on launch emails"),
]
GOOD = dict(measurable_outcome=True, activity_only=False,
            verifiable_deliverable=True, fits_one_week=True,
            independent_deliverable=True)
CHECKS = dict(main_goal_explains_value=True, go_to_market_covered=True,
              weekly_scope_realistic=True)


def service_with_output(monkeypatch, output):
    monkeypatch.setattr(ai.settings, "GOOGLE_API_KEY", "offline-test-key")
    monkeypatch.setattr(ai, "GoogleProvider", lambda *, api_key: object())
    monkeypatch.setattr(
        ai, "GoogleModel",
        lambda name, *, provider: TestModel(custom_output_args=output),
    )
    session = RecordingSession()
    return ai.AIService(session, uuid.uuid4(), uuid.uuid4()), session


@pytest.mark.asyncio
async def test_review_rejects_missing_task_assessment(monkeypatch, caplog):
    output = dict(verdict="approve", findings=[],
                  task_assessments=[dict(task_id="main-1", **GOOD)],
                  plan_checks=CHECKS)
    service, session = service_with_output(monkeypatch, output)

    with pytest.raises(APIException) as error:
        await service.review(TASKS)

    assert error.value.code == "AI_INVALID_OUTPUT"
    assert len(session.usage) == 1
    assert session.usage[0].outcome == "invalid_output"
    diagnostics = [record.message for record in caplog.records
                   if "ai_review_invalid_output" in record.message]
    assert diagnostics and all("reason=task_coverage" in message for message in diagnostics)
    assert all("Work on launch emails" not in message and "main-1" not in message
               for message in diagnostics)


@pytest.mark.asyncio
async def test_review_rejects_approval_when_flagged_task_has_no_finding(monkeypatch):
    output = dict(verdict="approve", findings=[],
                  task_assessments=[dict(task_id="main-1", **GOOD),
                                    dict(task_id="sub-1", **{**GOOD, "activity_only": True})],
                  plan_checks=CHECKS)
    service, session = service_with_output(monkeypatch, output)

    with pytest.raises(APIException) as error:
        await service.review(TASKS)

    assert error.value.code == "AI_INVALID_OUTPUT"
    assert session.usage[0].outcome == "invalid_output"


@pytest.mark.asyncio
async def test_review_adjusts_verdict_when_actionable_finding_exists(monkeypatch):
    output = dict(
        verdict="approve",
        findings=[dict(task_id="sub-1", problem="Activity has no measurable result",
                       suggested_rewrite="Launch email is ready for review")],
        task_assessments=[dict(task_id="main-1", **GOOD),
                          dict(task_id="sub-1", **{**GOOD, "activity_only": True})],
        plan_checks=CHECKS,
    )
    service, session = service_with_output(monkeypatch, output)

    review = await service.review(TASKS)

    assert isinstance(review, ai.PlanReview)
    assert review.verdict == "adjust"
    assert [finding.task_id for finding in review.findings] == ["sub-1"]
    assert session.usage[0].outcome == "success"


@pytest.mark.asyncio
async def test_review_retries_incomplete_coverage_and_accepts_corrected_output():
    calls = []

    async def respond(messages, info):
        calls.append(messages)
        assessments = [dict(task_id="main-1", **GOOD)]
        if len(calls) == 2:
            assessments.append(dict(task_id="sub-1", **GOOD))
        output = dict(verdict="approve", findings=[], task_assessments=assessments,
                      plan_checks=CHECKS)
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, output)])

    session = RecordingSession()
    service = ai.AIService(session, uuid.uuid4(), uuid.uuid4(), model=FunctionModel(respond))
    review = await service.review(TASKS)

    assert review.verdict == "approve"
    assert review.findings == []
    assert len(calls) == 2
    assert len(session.usage) == 1
    assert session.usage[0].outcome == "success"


@pytest.mark.asyncio
async def test_review_retries_missing_finding_with_specific_feedback():
    calls = []

    async def respond(messages, info):
        calls.append(messages)
        output = {
            "verdict": "adjust",
            "findings": (
                [{"task_id": "sub-1", "problem": "Activity has no measurable result",
                  "suggested_rewrite": "Launch email is ready for review"}]
                if len(calls) == 3 else []
            ),
            "task_assessments": [{"task_id": "main-1", **GOOD},
                                 {"task_id": "sub-1", **GOOD, "activity_only": True}],
            "plan_checks": CHECKS,
        }
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, output)])

    session = RecordingSession()
    service = ai.AIService(session, uuid.uuid4(), uuid.uuid4(), model=FunctionModel(respond))
    review = await service.review(TASKS)

    assert len(calls) == 3
    assert review.verdict == "adjust"
    assert [finding.task_id for finding in review.findings] == ["sub-1"]
    assert "sub-1" in str(calls[1])
    assert "no finding" in str(calls[1])
    assert session.usage[0].outcome == "success"


@pytest.mark.asyncio
async def test_review_still_rejects_missing_finding_after_bounded_retries():
    calls = []

    async def respond(messages, info):
        calls.append(messages)
        output = {
            "verdict": "approve", "findings": [],
            "task_assessments": [{"task_id": "main-1", **GOOD},
                                 {"task_id": "sub-1", **GOOD, "activity_only": True}],
            "plan_checks": CHECKS,
        }
        return ModelResponse(parts=[ToolCallPart(info.output_tools[0].name, output)])

    session = RecordingSession()
    service = ai.AIService(session, uuid.uuid4(), uuid.uuid4(), model=FunctionModel(respond))
    with pytest.raises(APIException) as error:
        await service.review(TASKS)

    assert len(calls) == 3
    assert error.value.code == "AI_INVALID_OUTPUT"
    assert error.value.status_code == 503
    assert "sub-1" not in error.value.message
    assert session.usage[0].outcome == "invalid_output"
