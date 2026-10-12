import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  ArrowRight,
  Target,
  UsersRound,
  ShieldAlert,
  Sparkles,
  ListTodo,
  CircleAlert,
  Check,
} from "lucide-react";
import { myPlans } from "@/api/endpoints/plans/plans";
import { listTeams } from "@/api/endpoints/teams/teams";
import { useCurrentUser } from "@/contexts/user-context";
import { useOrganization } from "@/contexts/organization-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_main/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const user = useCurrentUser();
  const { organization, isLoading: isOrgLoading, isError: isOrgError } = useOrganization();
  const orgId = organization?.id ?? "";

  const plans = useQuery({
    queryKey: ["my-plans", orgId],
    queryFn: () => myPlans(orgId),
    enabled: !!orgId,
  });

  const teams = useQuery({
    queryKey: ["teams", orgId],
    queryFn: () => listTeams(orgId),
    enabled: !!orgId,
  });

  // Current plan (most recent)
  const currentPlan = plans.data?.[0];
  const allTasks = currentPlan?.tasks ?? [];
  const completedTasks = allTasks.filter((t) => t.is_done);
  const totalTasksCount = allTasks.length;
  const completionRate =
    totalTasksCount > 0
      ? Math.round((completedTasks.length / totalTasksCount) * 100)
      : 0;

  // Find explicit main goal task
  const mainGoalTask = allTasks.find((t) => t.kind === "main");
  const subGoalTasks = allTasks.filter((t) => t.kind !== "main");

  // Plan status color and display helper
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "approved":
        return {
          label: "Approved",
          className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          icon: CheckCircle2,
        };
      case "submitted":
        return {
          label: "Awaiting review",
          className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          icon: Clock,
        };
      case "draft":
        return {
          label: "Draft",
          className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
          icon: Clock,
        };
      case "finished":
        return {
          label: "Finished",
          className: "bg-muted text-muted-foreground border-border",
          icon: CheckCircle2,
        };
      default:
        return {
          label: "Not started",
          className: "bg-muted text-muted-foreground border-border",
          icon: CircleAlert,
        };
    }
  };

  const statusInfo = getStatusBadge(currentPlan?.status);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-8">
      {/* Top Welcome / Overview Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Your week at a glance
            </h1>
            {organization && (
              <span className="hidden sm:inline-flex items-center rounded-md border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {organization.name}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {user ? `Welcome back, ${user.first_name}.` : "Welcome back."} Plan the week. Ship the goal.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/plans"
            className={cn(
              buttonVariants({ size: "default" }),
              "h-10 rounded-lg px-4 text-xs font-medium shadow-xs cursor-pointer gap-2"
            )}
          >
            <ListTodo className="size-4" />
            <span>Open weekly plan</span>
            <ArrowRight className="size-3.5 opacity-70" />
          </Link>
        </div>
      </div>

      {/* Loading & Error States */}
      {isOrgLoading && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading workspace and active organization…
        </div>
      )}

      {isOrgError && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-center text-sm text-destructive">
          Could not load your organizations. Please check your connection or sign in again.
        </div>
      )}

      {!isOrgLoading && !organization && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No active organization found</CardTitle>
            <CardDescription>
              You need an organization to plan weeks and collaborate with team members.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Ask your team lead for an invitation link or create a new account to register an organization.
            </p>
          </CardContent>
        </Card>
      )}

      {organization && (
        <>
          {/* Metric KPI Cards (Inspired by Reference Hierarchy) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Plan Status */}
            <Card className="rounded-xl border border-border bg-card shadow-xs transition-shadow hover:shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Weekly Plan Status
                </CardDescription>
                <div className="mt-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
                        statusInfo.className
                      )}
                    >
                      <StatusIcon className="size-3.5" />
                      {statusInfo.label}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2 text-xs text-muted-foreground">
                {currentPlan?.week_start
                  ? `Week of ${new Date(currentPlan.week_start).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}`
                  : "No plan scheduled yet"}
              </CardContent>
            </Card>

            {/* Card 2: Tasks Completed */}
            <Card className="rounded-xl border border-border bg-card shadow-xs transition-shadow hover:shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Tasks Completed
                </CardDescription>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-foreground">
                    {completedTasks.length}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    / {totalTasksCount} tasks
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {completionRate}%
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Main Goal Shipped Status */}
            <Card className="rounded-xl border border-border bg-card shadow-xs transition-shadow hover:shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Main Goal Shipped
                </CardDescription>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-foreground">
                    {currentPlan?.main_shipped === true
                      ? "Shipped"
                      : currentPlan?.main_shipped === false
                        ? "Not shipped"
                        : "In progress"}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-2 text-xs text-muted-foreground">
                {currentPlan?.main_shipped
                  ? "Marked shipped during end of week"
                  : "Explicitly tracked at week closure"}
              </CardContent>
            </Card>

            {/* Card 4: Teams & Role */}
            <Card className="rounded-xl border border-border bg-card shadow-xs transition-shadow hover:shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Team &amp; Role
                </CardDescription>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-foreground">
                    {teams.data?.length ?? 0}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    {teams.data?.length === 1 ? "team" : "teams"} active
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-2 text-xs text-muted-foreground">
                Role: <span className="capitalize font-semibold text-foreground">{organization.role}</span>
              </CardContent>
            </Card>
          </div>

          {/* Main Content: Shippable Goal Showcase & Plan Actions */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left Column (8 cols): Main Goal Card & Task Overview */}
            <div className="space-y-6 lg:col-span-8">
              {currentPlan ? (
                <Card className="rounded-xl border border-border bg-card shadow-xs">
                  <CardHeader className="border-b border-border/60 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="size-4 text-primary" />
                        <CardTitle className="text-base font-semibold">
                          Main Shippable Goal
                        </CardTitle>
                      </div>
                      <Link
                        to="/plans"
                        className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        Manage in plans
                        <ArrowRight className="size-3" />
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    {mainGoalTask ? (
                      <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2">
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border text-xs",
                              mainGoalTask.is_done
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-muted-foreground/40 bg-background text-transparent"
                            )}
                          >
                            <Check className="size-3 stroke-[3]" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground leading-snug">
                              {mainGoalTask.text || "Goal title not specified"}
                            </p>
                            {mainGoalTask.why_it_matters && (
                              <p className="text-xs text-muted-foreground">
                                <strong className="font-medium text-foreground">Why it matters: </strong>
                                {mainGoalTask.why_it_matters}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No primary goal specified for this plan yet.
                      </p>
                    )}

                    {/* Sub-goals / Supporting Tasks Breakdown */}
                    {subGoalTasks.length > 0 && (
                      <div className="pt-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                          Supporting Deliverables ({completedTasks.filter((t) => t.kind !== "main").length}/{subGoalTasks.length})
                        </h4>
                        <div className="divide-y divide-border/50 rounded-lg border border-border/60 bg-background/50">
                          {subGoalTasks.map((task) => (
                            <div
                              key={task.id}
                              className="flex items-center justify-between p-3 text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <span
                                  className={cn(
                                    "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                                    task.is_done
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "border-muted-foreground/30 bg-background text-transparent"
                                  )}
                                >
                                  <Check className="size-2.5 stroke-[3]" />
                                </span>
                                <span
                                  className={cn(
                                    "truncate font-medium",
                                    task.is_done
                                      ? "line-through text-muted-foreground"
                                      : "text-foreground"
                                  )}
                                >
                                  {task.text}
                                </span>
                              </div>
                              <span className="shrink-0 text-[10px] font-mono uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {task.kind.replace("_", " ")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                /* Welcoming Empty State */
                <Card className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center shadow-xs">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
                    <Sparkles className="size-6" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">
                    No active plan for this week
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground leading-relaxed">
                    WeekCurve keeps your team aligned around one shippable weekly outcome with Pydantic AI reviews, task breakdown, and Friday lookbacks.
                  </p>
                  <div className="mt-6">
                    <Link
                      to="/plans"
                      className={cn(
                        buttonVariants({ size: "default" }),
                        "h-10 rounded-lg px-4 text-xs font-medium cursor-pointer"
                      )}
                    >
                      Start your weekly plan
                    </Link>
                  </div>
                </Card>
              )}
            </div>

            {/* Right Column (4 cols): Context and Quick Actions */}
            <div className="space-y-6 lg:col-span-4">
              {/* Guidance & Review Status */}
              <Card className="rounded-xl border border-border bg-card shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CalendarDays className="size-4 text-primary" />
                    Weekly Workflow Guide
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      1
                    </span>
                    <p>
                      <strong className="text-foreground">Draft &amp; AI Review:</strong> Write your core goal and run AI feedback for rigor.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      2
                    </span>
                    <p>
                      <strong className="text-foreground">Lead Approval:</strong> Submit your plan for team lead sign-off.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      3
                    </span>
                    <p>
                      <strong className="text-foreground">Ship &amp; Summarize:</strong> Track task checkboxes and generate Friday summaries.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Team Collaboration Shortcuts */}
              <Card className="rounded-xl border border-border bg-card shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <UsersRound className="size-4 text-primary" />
                    Team Quick Links
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link
                    to="/teams"
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <span>Inspect Team Boards</span>
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                  </Link>
                  <Link
                    to="/settings"
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <span>Organization Settings</span>
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
