import uuid
from datetime import UTC, date, datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import (
    ConflictException,
    ResourceNotFoundException,
    ValidationException,
)
from app.models import PlanEvent, PlanTask, PlanTeam, TeamMembership, WeeklyPlan


class PlanService:
    def __init__(self, session: AsyncSession, organization_id: uuid.UUID):
        self.session = session
        self.organization_id = organization_id

    async def get(self, plan_id: uuid.UUID) -> WeeklyPlan:
        plan = await self.session.scalar(select(WeeklyPlan).where(
            WeeklyPlan.id == plan_id, WeeklyPlan.organization_id == self.organization_id))
        if plan is None:
            raise ResourceNotFoundException("Plan not found")
        return plan

    async def tasks(self, plan_id: uuid.UUID) -> list[PlanTask]:
        return list((await self.session.scalars(select(PlanTask).where(
            PlanTask.plan_id == plan_id, PlanTask.organization_id == self.organization_id)
            .order_by(PlanTask.position))).all())

    async def save_draft(self, author_id: uuid.UUID, week_start: date, items: list[dict]) -> WeeklyPlan:
        if week_start.weekday() != 0:
            raise ValidationException("Week must start on Monday", "week_start")
        if sum(item["kind"] == "main" for item in items) != 1:
            raise ValidationException("A plan needs exactly one main task", "tasks")
        primary = await self.session.scalar(select(TeamMembership).where(
            TeamMembership.organization_id == self.organization_id,
            TeamMembership.membership_id == author_id,
            TeamMembership.is_primary.is_(True)))
        if primary is None:
            raise ValidationException("Ask an organization admin to assign your primary team")
        plan = await self.session.scalar(select(WeeklyPlan).where(
            WeeklyPlan.organization_id == self.organization_id,
            WeeklyPlan.author_membership_id == author_id,
            WeeklyPlan.week_start == week_start).with_for_update())
        if plan is None:
            plan = WeeklyPlan(organization_id=self.organization_id, author_membership_id=author_id,
                              primary_team_id=primary.team_id, week_start=week_start, status="draft")
            self.session.add(plan)
            await self.session.flush()
            teams = (await self.session.scalars(select(TeamMembership.team_id).where(
                TeamMembership.organization_id == self.organization_id,
                TeamMembership.membership_id == author_id))).all()
            for team_id in teams:
                self.session.add(PlanTeam(organization_id=self.organization_id,
                    plan_id=plan.id, team_id=team_id))
        elif plan.status != "draft":
            raise ConflictException("Only draft plans can be edited")
        await self.session.execute(delete(PlanTask).where(PlanTask.plan_id == plan.id,
            PlanTask.organization_id == self.organization_id))
        await self.session.flush()
        for position, item in enumerate(items):
            self.session.add(PlanTask(organization_id=self.organization_id, plan_id=plan.id,
                kind=item["kind"], text=item["text"], why_it_matters=item.get("why_it_matters"),
                position=position, is_done=False))
        await self.session.flush()
        await self.event(plan.id, author_id, "draft_saved")
        return plan

    async def event(self, plan_id: uuid.UUID, actor_id: uuid.UUID, action: str,
                    comment: str | None = None) -> None:
        self.session.add(PlanEvent(organization_id=self.organization_id, plan_id=plan_id,
            actor_membership_id=actor_id, action=action, comment=comment))
        await self.session.flush()

    async def require_lead(self, plan: WeeklyPlan, member_id: uuid.UUID) -> None:
        lead = await self.session.scalar(select(TeamMembership.id).where(
            TeamMembership.organization_id == self.organization_id,
            TeamMembership.team_id == plan.primary_team_id,
            TeamMembership.membership_id == member_id,
            TeamMembership.is_lead.is_(True)))
        if lead is None:
            raise ResourceNotFoundException("Plan not found")

    async def submit(self, plan: WeeklyPlan, actor_id: uuid.UUID) -> None:
        if plan.author_membership_id != actor_id:
            raise ResourceNotFoundException("Plan not found")
        if plan.status != "draft":
            raise ConflictException("Only draft plans can be submitted")
        tasks = await self.tasks(plan.id)
        if sum(t.kind == "main" for t in tasks) != 1 or not any(t.kind == "sub_goal" for t in tasks):
            raise ValidationException("Add a main task and at least one sub-goal")
        main = next(t for t in tasks if t.kind == "main")
        if not main.why_it_matters:
            raise ValidationException("Explain why the main task matters")
        lead = await self.session.scalar(select(TeamMembership.id).where(
            TeamMembership.organization_id == self.organization_id,
            TeamMembership.team_id == plan.primary_team_id,
            TeamMembership.is_lead.is_(True)))
        if lead is None:
            raise ValidationException("Ask an organization admin to assign a lead to your primary team")
        plan.status = "submitted"
        plan.submitted_at = datetime.now(UTC)
        await self.event(plan.id, actor_id, "submitted")

    async def decide(self, plan: WeeklyPlan, actor_id: uuid.UUID, approve: bool,
                     comment: str | None) -> None:
        await self.require_lead(plan, actor_id)
        if plan.status != "submitted":
            raise ConflictException("Only submitted plans can be reviewed")
        if not approve and not comment:
            raise ValidationException("A send-back comment is required", "comment")
        plan.status = "approved" if approve else "draft"
        if approve:
            plan.approved_at = datetime.now(UTC)
        await self.event(plan.id, actor_id, "approved" if approve else "sent_back", comment)

    async def toggle_task(self, plan: WeeklyPlan, task_id: uuid.UUID, actor_id: uuid.UUID,
                          is_done: bool) -> PlanTask:
        if plan.author_membership_id != actor_id:
            raise ResourceNotFoundException("Plan not found")
        if plan.status != "approved":
            raise ConflictException("Tasks can be completed after approval")
        task = await self.session.scalar(select(PlanTask).where(PlanTask.id == task_id,
            PlanTask.plan_id == plan.id, PlanTask.organization_id == self.organization_id))
        if task is None:
            raise ResourceNotFoundException("Task not found")
        task.is_done = is_done
        await self.event(plan.id, actor_id, "task_completed" if is_done else "task_reopened")
        return task

    async def finish(self, plan: WeeklyPlan, actor_id: uuid.UUID, shipped: bool) -> None:
        if plan.author_membership_id != actor_id:
            raise ResourceNotFoundException("Plan not found")
        if plan.status != "approved":
            raise ConflictException("Only approved plans can be finished")
        plan.status = "done"
        plan.main_shipped = shipped
        plan.completed_at = datetime.now(UTC)
        await self.event(plan.id, actor_id, "finished", "shipped" if shipped else "not shipped")
