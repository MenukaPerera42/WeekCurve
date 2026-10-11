from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
    types,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


class IdMixin:
    # Mixin columns sort after the model's own columns by default; keep the
    # primary key first in generated migrations.
    id: Mapped[uuid.UUID] = mapped_column(
        types.Uuid, primary_key=True, default=uuid.uuid4, sort_order=-1
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=_utcnow, nullable=True
    )


class User(IdMixin, TimestampMixin, Base):
    __tablename__ = "users"

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(254), nullable=False, unique=True)
    password: Mapped[str | None] = mapped_column(String(128), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class Organization(IdMixin, TimestampMixin, Base):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    suspended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class OrganizationMembership(IdMixin, TimestampMixin, Base):
    __tablename__ = "organization_memberships"
    __table_args__ = (
        UniqueConstraint("organization_id", "user_id"),
        UniqueConstraint("id", "organization_id"),
        CheckConstraint("role IN ('owner', 'admin', 'member')", name="org_role_valid"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class OrganizationInvite(IdMixin, TimestampMixin, Base):
    __tablename__ = "organization_invites"
    __table_args__ = (CheckConstraint("role IN ('admin', 'member')", name="invite_role_valid"),)

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(254), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    redeemed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Team(IdMixin, TimestampMixin, Base):
    __tablename__ = "teams"
    __table_args__ = (
        UniqueConstraint("organization_id", "name"),
        UniqueConstraint("id", "organization_id"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)


class TeamMembership(IdMixin, TimestampMixin, Base):
    __tablename__ = "team_memberships"
    __table_args__ = (
        ForeignKeyConstraint(["team_id", "organization_id"], ["teams.id", "teams.organization_id"]),
        ForeignKeyConstraint(["membership_id", "organization_id"], ["organization_memberships.id", "organization_memberships.organization_id"]),
        UniqueConstraint("team_id", "membership_id"),
        Index("uq_team_lead", "team_id", unique=True, postgresql_where=text("is_lead")),
        Index("uq_primary_team", "membership_id", unique=True, postgresql_where=text("is_primary")),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    team_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    membership_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    is_lead: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class WeeklyPlan(IdMixin, TimestampMixin, Base):
    __tablename__ = "weekly_plans"
    __table_args__ = (
        ForeignKeyConstraint(["author_membership_id", "organization_id"], ["organization_memberships.id", "organization_memberships.organization_id"]),
        ForeignKeyConstraint(["primary_team_id", "organization_id"], ["teams.id", "teams.organization_id"]),
        UniqueConstraint("organization_id", "author_membership_id", "week_start"),
        UniqueConstraint("id", "organization_id"),
        CheckConstraint("status IN ('draft', 'submitted', 'approved', 'done')", name="plan_status_valid"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    author_membership_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    primary_team_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    main_shipped: Mapped[bool | None] = mapped_column(Boolean)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PlanTeam(IdMixin, Base):
    __tablename__ = "plan_teams"
    __table_args__ = (
        ForeignKeyConstraint(["plan_id", "organization_id"], ["weekly_plans.id", "weekly_plans.organization_id"]),
        ForeignKeyConstraint(["team_id", "organization_id"], ["teams.id", "teams.organization_id"]),
        UniqueConstraint("plan_id", "team_id"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    plan_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    team_id: Mapped[uuid.UUID] = mapped_column(nullable=False)


class PlanTask(IdMixin, TimestampMixin, Base):
    __tablename__ = "plan_tasks"
    __table_args__ = (
        ForeignKeyConstraint(["plan_id", "organization_id"], ["weekly_plans.id", "weekly_plans.organization_id"]),
        CheckConstraint("kind IN ('main', 'sub_goal', 'go_to_market')", name="task_kind_valid"),
        Index("uq_main_task", "plan_id", unique=True, postgresql_where=text("kind = 'main'")),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    plan_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    why_it_matters: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class PlanEvent(IdMixin, Base):
    __tablename__ = "plan_events"
    __table_args__ = (
        ForeignKeyConstraint(["plan_id", "organization_id"], ["weekly_plans.id", "weekly_plans.organization_id"]),
        ForeignKeyConstraint(["actor_membership_id", "organization_id"], ["organization_memberships.id", "organization_memberships.organization_id"]),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    plan_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    actor_membership_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


class AIUsage(IdMixin, Base):
    __tablename__ = "ai_usage"
    __table_args__ = (ForeignKeyConstraint(["actor_membership_id", "organization_id"], ["organization_memberships.id", "organization_memberships.organization_id"]),)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    actor_membership_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    feature: Mapped[str] = mapped_column(String(32), nullable=False)
    outcome: Mapped[str] = mapped_column(String(24), nullable=False)
    provider_status: Mapped[int | None] = mapped_column(Integer)
    model: Mapped[str] = mapped_column(String(80), nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
