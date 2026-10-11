import uuid

import pytest
from pydantic_ai.models.test import TestModel
from sqlalchemy import select

from app.exceptions import APIException
from app.models import AIUsage, Organization, OrganizationMembership, User
from app.services.ai import AIService, ReviewTask


@pytest.fixture
async def ai_context(session_factory):
    async with session_factory() as db:
        unique = uuid.uuid4().hex
        user = User(first_name="AI", last_name="Tester", email=f"ai-{unique}@example.test",
                    password=None, is_active=True, is_admin=False)
        db.add(user)
        await db.flush()
        org = Organization(name="AI Test", slug=f"ai-test-{unique}")
        db.add(org)
        await db.flush()
        membership = OrganizationMembership(organization_id=org.id, user_id=user.id, role="member")
        db.add(membership)
        await db.commit()
        yield db, org.id, membership.id


@pytest.mark.asyncio
async def test_review_uses_typed_output_and_records_usage(ai_context):
    db, org_id, member_id = ai_context
    task = ReviewTask(id="main-1", kind="main", text="Implement checkout")
    model = TestModel(custom_output_args={
        "verdict": "adjust",
        "findings": [{"task_id": "main-1", "problem": "This describes work, not a result",
                      "suggested_rewrite": "Expired cards are handled on staging"}],
    })
    review = await AIService(db, org_id, member_id, model=model).review([task])
    await db.commit()
    usage = (await db.scalars(select(AIUsage).where(AIUsage.organization_id == org_id))).all()
    assert review.verdict == "adjust"
    assert review.findings[0].task_id == task.id
    assert len(usage) == 1
    assert usage[0].outcome == "success"


@pytest.mark.asyncio
async def test_missing_key_records_unavailable_without_gemini(ai_context):
    db, org_id, member_id = ai_context
    with pytest.raises(APIException) as error:
        await AIService(db, org_id, member_id).review([
            ReviewTask(id="main-1", kind="main", text="Ship checkout")])
    await db.commit()
    usage = await db.scalar(select(AIUsage).where(AIUsage.organization_id == org_id))
    assert error.value.status_code == 503
    assert usage is not None and usage.outcome == "unavailable"
