import uuid
from datetime import date, datetime

from fastapi import APIRouter
from pydantic import Field
from sqlalchemy import select

from app.api.app.tenant import CurrentMembership
from app.database import DBSession
from app.exceptions import ResourceNotFoundException
from app.models import (
    OrganizationMembership,
    PlanEvent,
    PlanTeam,
    TeamMembership,
    User,
    WeeklyPlan,
)
from app.schemas import Model
from app.services.plans import PlanService

router = APIRouter()


class TaskInput(Model):
    kind: str = Field(pattern="^(main|sub_goal|go_to_market)$")
    text: str = Field(min_length=3, max_length=1000)
    why_it_matters: str | None = Field(default=None, max_length=1000)


class PlanInput(Model):
    tasks: list[TaskInput] = Field(min_length=2, max_length=20)


class TaskResponse(Model):
    id: uuid.UUID
    kind: str
    text: str
    why_it_matters: str | None
    position: int
    is_done: bool


class EventResponse(Model):
    action: str
    comment: str | None
    created_at: datetime


class PlanResponse(Model):
    id: uuid.UUID
    week_start: date
    status: str
    author_member_id: uuid.UUID
    primary_team_id: uuid.UUID
    main_shipped: bool | None
    tasks: list[TaskResponse]
    events: list[EventResponse]


class PlanSummary(Model):
    member_id: uuid.UUID
    member_name: str
    plan_id: uuid.UUID | None
    status: str
    tasks_done: int
    tasks_total: int
    main_shipped: bool | None


class DecisionInput(Model):
    comment: str | None = Field(default=None, max_length=2000)


class CompletionInput(Model):
    is_done: bool


class FinishInput(Model):
    main_shipped: bool


async def serialize_plan(session: DBSession, plan: WeeklyPlan) -> PlanResponse:
    tasks = await PlanService(session, plan.organization_id).tasks(plan.id)
    events = (await session.scalars(select(PlanEvent).where(
        PlanEvent.organization_id == plan.organization_id, PlanEvent.plan_id == plan.id)
        .order_by(PlanEvent.created_at))).all()
    return PlanResponse(id=plan.id, week_start=plan.week_start, status=plan.status,
        author_member_id=plan.author_membership_id, primary_team_id=plan.primary_team_id,
        main_shipped=plan.main_shipped,
        tasks=[TaskResponse.model_validate(t) for t in tasks],
        events=[EventResponse.model_validate(e) for e in events])


@router.get("/organizations/{organization_id}/plans", tags=["plans"])
async def my_plans(organization_id: uuid.UUID, membership: CurrentMembership,
                   session: DBSession) -> list[PlanResponse]:
    plans = (await session.scalars(select(WeeklyPlan).where(
        WeeklyPlan.organization_id == organization_id,
        WeeklyPlan.author_membership_id == membership.id)
        .order_by(WeeklyPlan.week_start.desc()))).all()
    return [await serialize_plan(session, p) for p in plans]


@router.put("/organizations/{organization_id}/plans/weeks/{week_start}", tags=["plans"])
async def save_draft(organization_id: uuid.UUID, week_start: date, data: PlanInput,
                     membership: CurrentMembership, session: DBSession) -> PlanResponse:
    plan = await PlanService(session, organization_id).save_draft(
        membership.id, week_start, [item.model_dump() for item in data.tasks])
    await session.commit()
    return await serialize_plan(session, plan)


@router.get("/organizations/{organization_id}/plans/{plan_id}", tags=["plans"])
async def get_plan(organization_id: uuid.UUID, plan_id: uuid.UUID,
                   membership: CurrentMembership, session: DBSession) -> PlanResponse:
    plan = await PlanService(session, organization_id).get(plan_id)
    if plan.author_membership_id != membership.id:
        visible = await session.scalar(select(PlanTeam.id).join(TeamMembership,
            TeamMembership.team_id == PlanTeam.team_id).where(
            PlanTeam.organization_id == organization_id, PlanTeam.plan_id == plan_id,
            TeamMembership.membership_id == membership.id,
            TeamMembership.organization_id == organization_id,
            TeamMembership.is_lead.is_(True)))
        if visible is None:
            raise ResourceNotFoundException("Plan not found")
    return await serialize_plan(session, plan)


@router.post("/organizations/{organization_id}/plans/{plan_id}/submit", tags=["plans"])
async def submit_plan(organization_id: uuid.UUID, plan_id: uuid.UUID,
                      membership: CurrentMembership, session: DBSession) -> PlanResponse:
    service = PlanService(session, organization_id)
    plan = await service.get(plan_id)
    await service.submit(plan, membership.id)
    await session.commit()
    return await serialize_plan(session, plan)


@router.post("/organizations/{organization_id}/plans/{plan_id}/approve", tags=["plans"])
async def approve_plan(organization_id: uuid.UUID, plan_id: uuid.UUID, data: DecisionInput,
                       membership: CurrentMembership, session: DBSession) -> PlanResponse:
    service = PlanService(session, organization_id)
    plan = await service.get(plan_id)
    await service.decide(plan, membership.id, True, data.comment)
    await session.commit()
    return await serialize_plan(session, plan)


@router.post("/organizations/{organization_id}/plans/{plan_id}/send-back", tags=["plans"])
async def send_back_plan(organization_id: uuid.UUID, plan_id: uuid.UUID, data: DecisionInput,
                         membership: CurrentMembership, session: DBSession) -> PlanResponse:
    service = PlanService(session, organization_id)
    plan = await service.get(plan_id)
    await service.decide(plan, membership.id, False, data.comment)
    await session.commit()
    return await serialize_plan(session, plan)


@router.patch("/organizations/{organization_id}/plans/{plan_id}/tasks/{task_id}", tags=["plans"])
async def complete_task(organization_id: uuid.UUID, plan_id: uuid.UUID, task_id: uuid.UUID,
                        data: CompletionInput, membership: CurrentMembership,
                        session: DBSession) -> PlanResponse:
    service = PlanService(session, organization_id)
    plan = await service.get(plan_id)
    await service.toggle_task(plan, task_id, membership.id, data.is_done)
    await session.commit()
    return await serialize_plan(session, plan)


@router.post("/organizations/{organization_id}/plans/{plan_id}/finish", tags=["plans"])
async def finish_plan(organization_id: uuid.UUID, plan_id: uuid.UUID, data: FinishInput,
                      membership: CurrentMembership, session: DBSession) -> PlanResponse:
    service = PlanService(session, organization_id)
    plan = await service.get(plan_id)
    await service.finish(plan, membership.id, data.main_shipped)
    await session.commit()
    return await serialize_plan(session, plan)


@router.get("/organizations/{organization_id}/teams/{team_id}/weeks/{week_start}", tags=["plans"])
async def team_week(organization_id: uuid.UUID, team_id: uuid.UUID, week_start: date,
                    membership: CurrentMembership, session: DBSession) -> list[PlanSummary]:
    lead = await session.scalar(select(TeamMembership.id).where(
        TeamMembership.organization_id == organization_id,
        TeamMembership.team_id == team_id,
        TeamMembership.membership_id == membership.id,
        TeamMembership.is_lead.is_(True)))
    if lead is None:
        raise ResourceNotFoundException("Team not found")
    rows = (await session.execute(select(OrganizationMembership, User)
        .join(TeamMembership, TeamMembership.membership_id == OrganizationMembership.id)
        .join(User, User.id == OrganizationMembership.user_id)
        .where(TeamMembership.organization_id == organization_id,
               TeamMembership.team_id == team_id).order_by(User.first_name))).all()
    historical = (await session.execute(select(OrganizationMembership, User)
        .join(WeeklyPlan, WeeklyPlan.author_membership_id == OrganizationMembership.id)
        .join(PlanTeam, PlanTeam.plan_id == WeeklyPlan.id)
        .join(User, User.id == OrganizationMembership.user_id)
        .where(WeeklyPlan.organization_id == organization_id,
               WeeklyPlan.week_start == week_start, PlanTeam.team_id == team_id))).all()
    people = {member.id: (member, user) for member, user in [*rows, *historical]}
    result = []
    for member, user in sorted(people.values(), key=lambda pair: pair[1].first_name):
        plan = await session.scalar(select(WeeklyPlan).join(PlanTeam, PlanTeam.plan_id == WeeklyPlan.id)
            .where(WeeklyPlan.organization_id == organization_id,
                   WeeklyPlan.author_membership_id == member.id,
                   WeeklyPlan.week_start == week_start, PlanTeam.team_id == team_id))
        tasks = await PlanService(session, organization_id).tasks(plan.id) if plan else []
        result.append(PlanSummary(member_id=member.id, member_name=f"{user.first_name} {user.last_name}",
            plan_id=plan.id if plan else None, status=plan.status if plan else "not_started",
            tasks_done=sum(t.is_done for t in tasks), tasks_total=len(tasks),
            main_shipped=plan.main_shipped if plan else None))
    return result
