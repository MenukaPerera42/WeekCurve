import asyncio
import inspect
import secrets
from datetime import UTC, datetime, timedelta
from functools import partial, wraps

from pydantic import ValidationError
from sqlalchemy import select
from typer import BadParameter, Option, Typer

from app.cli.schemas import UserCreate
from app.config import settings
from app.database import AsyncSessionLocal, async_engine
from app.models import OrganizationMembership, Team, TeamMembership, User
from app.security import hash_password
from app.services.plans import PlanService
from app.services.workspace import WorkspaceService


class AsyncTyper(Typer):
    @staticmethod
    def maybe_run_async(decorator, f):
        if inspect.iscoroutinefunction(f):

            @wraps(f)
            def runner(*args, **kwargs):
                # Close the shared session and dispose the engine's pool inside
                # the same event loop asyncio.run creates, so pooled asyncpg
                # connections are returned before the loop's greenlet is
                # finalized (otherwise the GC terminates them post-loop and
                # SQLAlchemy warns about non-checked-in connections).
                async def main():
                    try:
                        return await f(*args, **kwargs)
                    finally:
                        await session.close()
                        await async_engine.dispose()

                return asyncio.run(main())

            decorator(runner)
        else:
            decorator(f)
        return f

    def callback(self, *args, **kwargs):
        decorator = super().callback(*args, **kwargs)
        return partial(self.maybe_run_async, decorator)

    def command(self, *args, **kwargs):
        decorator = super().command(*args, **kwargs)
        return partial(self.maybe_run_async, decorator)


session = AsyncSessionLocal()
cli = AsyncTyper()


@cli.callback()
def main():
    """Launchbase management CLI."""
    # Present so Typer always runs in subcommand mode (`manage.py user-create`),
    # even while there is only a single command registered.


@cli.command()
async def create_user(
    first_name: str = Option(...),
    last_name: str = Option(...),
    email: str = Option(...),
    password: str = Option(None, help="Login password. Generated if not given."),
    admin: bool = Option(False, "--admin", help="Grant admin privileges."),
):
    """Create a user.

    The login password is generated unless provided with --password.
    Pass --admin to grant admin privileges.
    """
    try:
        data = UserCreate(first_name=first_name, last_name=last_name, email=email)
    except ValidationError as e:
        raise BadParameter("; ".join(err["msg"] for err in e.errors()))

    existing = (
        (await session.execute(select(User).where(User.email == data.email)))
        .scalars()
        .first()
    )
    if existing:
        raise BadParameter(f"User with email '{data.email}' already exists.")

    generated = password is None
    if generated:
        password = secrets.token_urlsafe(12)

    user = User(
        **data.model_dump(),
        password=hash_password(password),
        is_active=True,
        is_admin=admin,
    )
    session.add(user)
    await session.commit()
    print(f"{'Admin' if admin else 'User'} created: ", user.id)
    if generated:
        print("Generated password: ", password)


@cli.command()
async def seed_demo(password: str = Option(..., help="Password for local demo accounts.")):
    """Create repeatable, non-production WeekCurve demo data."""
    if settings.is_production:
        raise BadParameter("Demo data cannot be seeded in production")
    if len(password) < 12:
        raise BadParameter("Demo password must be at least 12 characters")
    service = WorkspaceService(session)
    today = datetime.now(UTC).date()
    monday = today - timedelta(days=today.weekday())
    for org_name, prefix in (("Northstar Labs", "northstar"), ("Harbor Works", "harbor")):
        existing = await session.scalar(select(User.id).where(User.email == f"owner@{prefix}.demo"))
        if existing:
            continue
        owner = await service.create_user("Olivia", "Owner", f"owner@{prefix}.demo", password)
        admin = await service.create_user("Ada", "Admin", f"admin@{prefix}.demo", password)
        lead = await service.create_user("Leo", "Lead", f"lead@{prefix}.demo", password)
        member = await service.create_user("Maya", "Member", f"member@{prefix}.demo", password)
        org = await service.create_organization(owner, org_name)
        owner_membership = await session.scalar(select(OrganizationMembership).where(
            OrganizationMembership.organization_id == org.id,
            OrganizationMembership.user_id == owner.id))
        assert owner_membership is not None
        members = [(admin, "admin"), (lead, "member"), (member, "member")]
        memberships = [owner_membership]
        for user, role in members:
            m = OrganizationMembership(organization_id=org.id, user_id=user.id, role=role)
            session.add(m)
            memberships.append(m)
        await session.flush()
        engineering = Team(organization_id=org.id, name="Engineering")
        growth = Team(organization_id=org.id, name="Growth")
        session.add_all([engineering, growth])
        await session.flush()
        for m in memberships:
            session.add(TeamMembership(organization_id=org.id, team_id=engineering.id,
                membership_id=m.id, is_lead=m.user_id == lead.id, is_primary=True))
        session.add(TeamMembership(organization_id=org.id, team_id=growth.id,
            membership_id=next(m.id for m in memberships if m.user_id == member.id),
            is_lead=False, is_primary=False))
        await session.flush()
        plans = PlanService(session, org.id)
        for weeks_ago in range(3):
            week = monday - timedelta(weeks=weeks_ago)
            for author in (lead, member):
                author_membership = next(m for m in memberships if m.user_id == author.id)
                plan = await plans.save_draft(author_membership.id, week, [
                    {"kind": "main", "text": "Checkout handles expired cards on staging",
                     "why_it_matters": "Customers can recover from failed payments"},
                    {"kind": "sub_goal", "text": "Expired-card tests pass in staging"},
                    {"kind": "go_to_market", "text": "Release note is published"},
                ])
                if weeks_ago == 0 and author.id == member.id:
                    continue
                await plans.submit(plan, author_membership.id)
                if weeks_ago == 0:
                    continue
                lead_membership = next(m for m in memberships if m.user_id == lead.id)
                await plans.decide(plan, lead_membership.id, True, "Clear outcomes")
                tasks = await plans.tasks(plan.id)
                for task in tasks[:2]:
                    await plans.toggle_task(plan, task.id, author_membership.id, True)
                await plans.finish(plan, author_membership.id, weeks_ago == 2)
        await session.commit()
    print("Demo users: owner/admin/lead/member@northstar.demo and @harbor.demo")
    print("All demo users use the password supplied to --password")
