import uuid

import pytest
from pydantic_ai.exceptions import ModelHTTPError
from pydantic_ai.models.function import FunctionModel
from pydantic_ai.models.test import TestModel
from sqlalchemy import func, select

from app.exceptions import APIException
from app.models import AIUsage, Organization, OrganizationMembership, User, WeeklyPlan
from app.services.ai import AIService, GeneratedPlan, PlanReview, ReviewTask


@pytest.fixture
async def ai_case(session_factory, request):
    # The container is shared across tests, so keep stable, test-specific identities.
    suffix = uuid.uuid5(uuid.NAMESPACE_URL, request.node.name).hex
    async with session_factory() as db:
        user = User(
            first_name="AI", last_name="Tester", email=f"ai-{suffix}@example.test",
            password=None, is_active=True, is_admin=False,
        )
        db.add(user)
        await db.flush()
        org = Organization(name="AI Test", slug=f"ai-test-{suffix}")
        db.add(org)
        await db.flush()
        membership = OrganizationMembership(
            organization_id=org.id, user_id=user.id, role="member"
        )
        db.add(membership)
        await db.commit()
        yield db, org.id, membership.id


async def usage_for(db, org_id):
    rows = (await db.scalars(
        select(AIUsage).where(AIUsage.organization_id == org_id)
    )).all()
    assert len(rows) == 1
    return rows[0]


@pytest.mark.asyncio
async def test_brain_dump_returns_editable_typed_draft_without_saving_plan(ai_case):
    db, org_id, member_id = ai_case
    model = TestModel(custom_output_args={
        "tasks": [
            {"kind": "main", "text": "Billing page works on staging",
             "why_it_matters": "Customers can complete purchases"},
            {"kind": "sub_goal", "text": "Webhook retry tests pass"},
            {"kind": "go_to_market", "text": "Changelog entry is published"},
        ],
    })
    draft = await AIService(db, org_id, member_id, model=model).generate(
        "Finish the billing page, fix webhook retries, and announce it in the changelog."
    )
    await db.commit()

    assert isinstance(draft, GeneratedPlan)
    assert [task.kind for task in draft.tasks] == [
        "main", "sub_goal", "go_to_market"
    ]
    assert draft.tasks[0].why_it_matters == "Customers can complete purchases"
    assert draft.tasks[1].text == "Webhook retry tests pass"
    plan_count = await db.scalar(
        select(func.count()).select_from(WeeklyPlan).where(
            WeeklyPlan.organization_id == org_id
        )
    )
    assert plan_count == 0
    usage = await usage_for(db, org_id)
    assert usage.actor_membership_id == member_id
    assert usage.feature == "brain_dump"
    assert usage.outcome == "success"


@pytest.mark.asyncio
async def test_review_links_concrete_rewrites_to_their_input_tasks(ai_case):
    db, org_id, member_id = ai_case
    tasks = [
        ReviewTask(id="main-1", kind="main", text="Implement checkout"),
        ReviewTask(id="sub-1", kind="sub_goal", text="Fix webhooks"),
    ]
    model = TestModel(custom_output_args={
        "verdict": "adjust",
        "findings": [
            {"task_id": "main-1", "problem": "No verifiable result or reason",
             "suggested_rewrite": "Expired cards recover on staging"},
            {"task_id": "sub-1", "problem": "The task describes activity",
             "suggested_rewrite": "Webhook retry tests pass on staging"},
        ],
    })
    review = await AIService(db, org_id, member_id, model=model).review(tasks)
    await db.commit()

    assert isinstance(review, PlanReview)
    assert review.verdict == "adjust"
    assert [(finding.task_id, finding.suggested_rewrite)
            for finding in review.findings] == [
        ("main-1", "Expired cards recover on staging"),
        ("sub-1", "Webhook retry tests pass on staging"),
    ]
    assert (await usage_for(db, org_id)).outcome == "success"


@pytest.mark.asyncio
async def test_rate_limit_is_sanitized_and_recorded_per_organization(ai_case):
    db, org_id, member_id = ai_case
    private_provider_body = "private-provider-payload"

    async def rate_limited(messages, info):
        raise ModelHTTPError(
            429, "gemini-3.5-flash-lite", body={"error": private_provider_body}
        )

    with pytest.raises(APIException) as error:
        await AIService(
            db, org_id, member_id, model=FunctionModel(rate_limited)
        ).generate("Finish billing and publish a changelog entry this week.")
    await db.commit()

    assert error.value.status_code == 429
    assert private_provider_body not in error.value.message
    assert "Try again later" in error.value.message
    usage = await usage_for(db, org_id)
    assert usage.feature == "brain_dump"
    assert usage.outcome == "rate_limited"
    assert usage.provider_status == 429
    assert usage.actor_membership_id == member_id


@pytest.mark.asyncio
async def test_timeout_has_safe_message_and_usage_record(ai_case):
    db, org_id, member_id = ai_case
    private_provider_detail = "private-timeout-detail"

    async def timed_out(messages, info):
        raise TimeoutError(private_provider_detail)

    with pytest.raises(APIException) as error:
        await AIService(
            db, org_id, member_id, model=FunctionModel(timed_out)
        ).generate("Finish billing and publish a changelog entry this week.")
    await db.commit()

    assert error.value.status_code == 503
    assert error.value.code == "AI_TIMEOUT"
    assert private_provider_detail not in error.value.message
    usage = await usage_for(db, org_id)
    assert usage.feature == "brain_dump"
    assert usage.outcome == "timeout"
    assert usage.provider_status is None


@pytest.mark.asyncio
async def test_typed_but_invalid_draft_is_rejected_and_recorded(ai_case):
    db, org_id, member_id = ai_case
    model = TestModel(custom_output_args={
        "tasks": [
            {"kind": "main", "text": "Billing works on staging"},
            {"kind": "main", "text": "Webhooks retry on staging"},
        ],
    })
    with pytest.raises(APIException) as error:
        await AIService(db, org_id, member_id, model=model).generate(
            "Finish the billing page and repair webhook retries this week."
        )
    await db.commit()

    assert error.value.status_code == 503
    assert error.value.code == "AI_INVALID_OUTPUT"
    usage = await usage_for(db, org_id)
    assert usage.feature == "brain_dump"
    assert usage.outcome == "invalid_output"
    plan_count = await db.scalar(
        select(func.count()).select_from(WeeklyPlan).where(
            WeeklyPlan.organization_id == org_id
        )
    )
    assert plan_count == 0
