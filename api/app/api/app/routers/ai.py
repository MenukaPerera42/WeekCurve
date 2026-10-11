import uuid

from fastapi import APIRouter
from pydantic import Field

from app.api.app.tenant import CurrentMembership
from app.database import DBSession
from app.schemas import Model
from app.services.ai import AIService, GeneratedPlan, PlanReview, ReviewTask

router = APIRouter()


class ReviewRequest(Model):
    tasks: list[ReviewTask] = Field(min_length=1, max_length=20)


class BrainDumpRequest(Model):
    notes: str = Field(min_length=15, max_length=5000)


@router.post("/organizations/{organization_id}/ai/review", tags=["ai"])
async def review_plan(organization_id: uuid.UUID, data: ReviewRequest,
                      membership: CurrentMembership, session: DBSession) -> PlanReview:
    try:
        return await AIService(session, organization_id, membership.id).review(data.tasks)
    finally:
        await session.commit()


@router.post("/organizations/{organization_id}/ai/draft", tags=["ai"])
async def generate_plan(organization_id: uuid.UUID, data: BrainDumpRequest,
                        membership: CurrentMembership, session: DBSession) -> GeneratedPlan:
    try:
        return await AIService(session, organization_id, membership.id).generate(data.notes)
    finally:
        await session.commit()
