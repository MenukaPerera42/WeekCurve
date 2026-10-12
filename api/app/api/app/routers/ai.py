import uuid
from datetime import date

from fastapi import APIRouter
from pydantic import Field

from app.api.app.tenant import CurrentMembership
from app.database import DBSession
from app.schemas import Model
from app.services.ai import (
    AIService, GeneratedPlan, LookbackAdvice, PlanReview, ReviewTask, TeamDigest,
    WeeklySummary,
)

router = APIRouter()


class ReviewRequest(Model):
    tasks: list[ReviewTask] = Field(min_length=1, max_length=20)


class BrainDumpRequest(Model):
    notes: str = Field(min_length=15, max_length=5000)


class WeeklySummaryRequest(Model):
    unfinished_explanation: str | None = Field(default=None, min_length=1, max_length=1000)


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


@router.post("/organizations/{organization_id}/ai/weeks/{week_start}/look-back", tags=["ai"])
async def look_back_before_planning(
    organization_id: uuid.UUID, week_start: date,
    membership: CurrentMembership, session: DBSession,
) -> LookbackAdvice:
    try:
        return await AIService(session, organization_id, membership.id).look_back(week_start)
    finally:
        await session.commit()


@router.post("/organizations/{organization_id}/ai/plans/{plan_id}/end-of-week-summary", tags=["ai"])
async def end_of_week_summary(
    organization_id: uuid.UUID, plan_id: uuid.UUID, data: WeeklySummaryRequest,
    membership: CurrentMembership, session: DBSession,
) -> WeeklySummary:
    try:
        return await AIService(session, organization_id, membership.id).summarize_week(
            plan_id, data.unfinished_explanation,
        )
    finally:
        await session.commit()


@router.post("/organizations/{organization_id}/ai/teams/{team_id}/weeks/{week_start}/digest", tags=["ai"])
async def team_digest(
    organization_id: uuid.UUID, team_id: uuid.UUID, week_start: date,
    membership: CurrentMembership, session: DBSession,
) -> TeamDigest:
    try:
        return await AIService(session, organization_id, membership.id).team_digest(team_id, week_start)
    finally:
        await session.commit()
