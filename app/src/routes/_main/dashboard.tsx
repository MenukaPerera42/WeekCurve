import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Sparkles,
  UsersRound,
  ArrowRight,
  ListTodo,
  Shield,
  CircleAlert,
  Check,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { myPlans } from "@/api/endpoints/plans/plans";
import { listTeams } from "@/api/endpoints/teams/teams";
import { useCurrentUser } from "@/contexts/user-context";
import { useOrganization } from "@/contexts/organization-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_main/dashboard")({
  component: DashboardPage,
});

function thisMonday() {
  const day = new Date();
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  const part = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${part(day.getMonth() + 1)}-${part(day.getDate())}`;
}

function DashboardPage() {
  const user = useCurrentUser();
  const { organization, isLoading: isOrgLoading, isError: isOrgError } = useOrganization();
  const orgId = organization?.id ?? "";
  const currentWeek = useMemo(() => thisMonday(), []);

  // Fetch all user plans
  const plans = useQuery({
    queryKey: ["my-plans", orgId],
    queryFn: () => myPlans(orgId),
    enabled: !!orgId,
  });

  // Fetch teams to compute user team membership
  const teamsQuery = useQuery({
    queryKey: ["teams", orgId],
    queryFn: () => listTeams(orgId),
    enabled: !!orgId,
  });

  // Current active plan for this week
  const currentPlan = useMemo(() => {
    return plans.data?.find((p) => p.week_start === currentWeek);
  }, [plans.data, currentWeek]);

  // Tasks statistics
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

  // Historical delivery chart data from real API plans
  const chartData = useMemo(() => {
    if (!plans.data || plans.data.length === 0) return [];
    const sorted = [...plans.data].sort(
      (a, b) => new Date(a.week_start).getTime() - new Date(b.week_start).getTime()
    );
    const recent = sorted.slice(-8);
    return recent.map((p) => {
      const total = p.tasks.length;
      const completed = p.tasks.filter((t) => t.is_done).length;
      return {
        week: new Date(p.week_start).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        weekStart: p.week_start,
        completed,
        remaining: Math.max(0, total - completed),
        total,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });
  }, [plans.data]);

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
          {/* Metric KPI Cards */}
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
                {currentPlan?.main_shipped === true
                  ? "Outcome recorded as shipped"
                  : currentPlan?.main_shipped === false
                    ? "Incomplete outcome logged"
                    : "Final outcome pending Friday finish"}
              </CardContent>
            </Card>

            {/* Card 4: Team and Role */}
            <Card className="rounded-xl border border-border bg-card shadow-xs transition-shadow hover:shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Team &amp; Role
                </CardDescription>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-sm font-semibold capitalize text-foreground">
                    {organization.role.replace("_", " ")}
                  </span>
                  <Shield className="size-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="pt-2 text-xs text-muted-foreground">
                {teamsQuery.data && teamsQuery.data.length > 0
                  ? `${teamsQuery.data.length} team${teamsQuery.data.length > 1 ? "s" : ""} registered`
                  : "No team assigned"}
              </CardContent>
            </Card>
          </div>

          {/* Middle Row: Two-Column Responsive Grid (~Half Width on Desktop) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Column 1: Weekly Delivery Progress Chart (~50% width on desktop) */}
            <Card className="rounded-xl border border-border bg-card shadow-xs">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <TrendingUp className="size-4 text-primary" />
                      Weekly Delivery Progress
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Completed vs remaining tasks over recent planning weeks
                    </CardDescription>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                    Velocity
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <div className="space-y-4">
                    <div className="h-60 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={chartData}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                          barGap={4}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            className="stroke-border/50"
                          />
                          <XAxis
                            dataKey="week"
                            tickLine={false}
                            axisLine={false}
                            className="text-[11px] fill-muted-foreground font-medium"
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            className="text-[11px] fill-muted-foreground font-medium"
                            allowDecimals={false}
                          />
                          <Tooltip
                            cursor={{ fill: "var(--color-muted)", opacity: 0.3 }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0].payload;
                              return (
                                <div className="rounded-xl border border-border bg-popover p-3 shadow-md text-xs text-popover-foreground space-y-1">
                                  <p className="font-semibold text-foreground">Week of {d.weekStart}</p>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-muted-foreground">Completed:</span>
                                    <span className="font-bold text-[#2563eb]">{d.completed}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-muted-foreground">Remaining:</span>
                                    <span className="font-bold text-muted-foreground">{d.remaining}</span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4 border-t border-border pt-1">
                                    <span className="text-muted-foreground">Total:</span>
                                    <span className="font-bold text-foreground">{d.total}</span>
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Bar
                            dataKey="completed"
                            name="Completed Tasks"
                            fill="#2563eb"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={32}
                          />
                          <Bar
                            dataKey="remaining"
                            name="Remaining Tasks"
                            fill="#94a3b8"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={32}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
                      <span>Delivery rate across {chartData.length} recorded plan{chartData.length === 1 ? "" : "s"}.</span>
                      <span className="font-medium text-foreground">
                        {chartData.reduce((acc, c) => acc + c.completed, 0)} completed / {chartData.reduce((acc, c) => acc + c.total, 0)} total tasks
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    <p>No historical delivery data recorded yet. Create and complete weekly plans to visualize delivery velocity.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Column 2: Main Shippable Goal & Deliverables Breakdown (~50% width on desktop) */}
            {currentPlan ? (
              <Card className="rounded-xl border border-border bg-card shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold">
                        Weekly Focus &amp; Deliverables
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Plan for week of {currentPlan.week_start}
                      </CardDescription>
                    </div>
                    <Link
                      to="/plans"
                      className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Edit plan
                      <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Primary Goal Banner */}
                  {mainGoalTask ? (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
                          G1
                        </span>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                              Main Shippable Goal
                            </span>
                            {mainGoalTask.is_done && (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <Check className="size-3" />
                                Shipped
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-foreground">
                            {mainGoalTask.text}
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
              <Card className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center shadow-xs flex flex-col items-center justify-center">
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

          {/* Bottom Row: Workflow Guide & Team Quick Links */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
        </>
      )}
    </div>
  );
}
