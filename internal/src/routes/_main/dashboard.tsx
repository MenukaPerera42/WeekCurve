import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Users,
  Building2,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Server,
  Activity,
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { userList } from "@/api/endpoints/users/users";
import { listOrganizations } from "@/api/endpoints/organizations/organizations";
import { aiUsage } from "@/api/endpoints/ai-usage/ai-usage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_main/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const usersQuery = useQuery({
    queryKey: ["admin-users-count"],
    queryFn: () => userList({ limit: 1 }),
  });

  const orgsQuery = useQuery({
    queryKey: ["admin-orgs"],
    queryFn: () => listOrganizations(),
  });

  const aiUsageQuery = useQuery({
    queryKey: ["admin-ai-usage"],
    queryFn: () => aiUsage(),
  });

  const totalUsers = usersQuery.data?.total;
  const totalOrgs = orgsQuery.data?.length;
  const activeOrgs = orgsQuery.data?.filter((o) => !o.suspended_at)?.length;
  const aiRequestsCount = useMemo(() => {
    if (!aiUsageQuery.data) return undefined;
    return aiUsageQuery.data.reduce((acc, row) => acc + (row.calls ?? 0), 0);
  }, [aiUsageQuery.data]);

  // Formatted chart data for AI usage by organization
  const chartData = useMemo(() => {
    if (!aiUsageQuery.data || aiUsageQuery.data.length === 0) return [];
    return aiUsageQuery.data.map((row) => ({
      name:
        row.organization_name.length > 14
          ? `${row.organization_name.slice(0, 12)}…`
          : row.organization_name,
      fullName: row.organization_name,
      successes: row.successes,
      failures: row.failures,
      rateLimited: row.rate_limited,
      calls: row.calls,
    }));
  }, [aiUsageQuery.data]);

  return (
    <div className="space-y-8">
      {/* Platform Overview Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Platform Overview
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              Internal Console
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor tenant workspaces, inspect user accounts, and audit AI usage across WeekCurve.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/ai-usage"
            className={cn(
              buttonVariants({ size: "default" }),
              "h-10 rounded-lg px-4 text-xs font-medium shadow-xs cursor-pointer gap-2"
            )}
          >
            <Activity className="size-4" />
            <span>Real-time AI telemetry</span>
            <ArrowRight className="size-3.5 opacity-70" />
          </Link>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Total Users */}
        <Card className="rounded-xl border border-border bg-card shadow-xs transition-shadow hover:shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Users
            </CardDescription>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {usersQuery.isLoading
                  ? "…"
                  : totalUsers !== undefined
                    ? totalUsers.toLocaleString()
                    : "—"}
              </span>
              <Users className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="pt-2 text-xs text-muted-foreground">
            <Link
              to="/users"
              className="font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              Inspect all users
              <ArrowRight className="size-3" />
            </Link>
          </CardContent>
        </Card>

        {/* Metric 2: Organizations */}
        <Card className="rounded-xl border border-border bg-card shadow-xs transition-shadow hover:shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Organizations
            </CardDescription>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {orgsQuery.isLoading
                  ? "…"
                  : totalOrgs !== undefined
                    ? totalOrgs.toLocaleString()
                    : "—"}
              </span>
              <Building2 className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="pt-2 text-xs text-muted-foreground">
            {activeOrgs !== undefined ? (
              <span>{activeOrgs} active · {(totalOrgs ?? 0) - activeOrgs} suspended</span>
            ) : (
              <span>Multi-tenant accounts</span>
            )}
          </CardContent>
        </Card>

        {/* Metric 3: AI Audit Records */}
        <Card className="rounded-xl border border-border bg-card shadow-xs transition-shadow hover:shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              AI Invocations
            </CardDescription>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {aiUsageQuery.isLoading
                  ? "…"
                  : aiRequestsCount !== undefined
                    ? aiRequestsCount.toLocaleString()
                    : "—"}
              </span>
              <Sparkles className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="pt-2 text-xs text-muted-foreground">
            <Link
              to="/ai-usage"
              className="font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              View usage breakdown
              <ArrowRight className="size-3" />
            </Link>
          </CardContent>
        </Card>

        {/* Metric 4: Platform Security Role */}
        <Card className="rounded-xl border border-border bg-card shadow-xs transition-shadow hover:shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Operator Role
            </CardDescription>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                Administrator
              </span>
              <ShieldAlert className="size-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="pt-2 text-xs text-muted-foreground">
            Platform governance authority
          </CardContent>
        </Card>
      </div>

      {/* Middle Row: Two-Column Responsive Grid (~Half Width on Desktop) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Column 1: AI Usage by Organization Recharts Chart */}
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">AI Usage by Organization</CardTitle>
                <CardDescription className="text-xs">
                  Successes, failures, and rate limits across customer workspaces
                </CardDescription>
              </div>
              <span className="text-xs font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                Audit Telemetry
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="space-y-4">
                {/* Series Legend */}
                <div className="flex items-center gap-4 text-xs pt-1">
                  <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                    <span className="size-2.5 rounded-sm bg-[#2563EB]" />
                    Successes
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                    <span className="size-2.5 rounded-sm bg-[#EF4444]" />
                    Failures
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                    <span className="size-2.5 rounded-sm bg-[#F59E0B]" />
                    Rate Limited
                  </span>
                </div>

                <div className="h-64 w-full pt-1">
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
                        dataKey="name"
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
                          const d = payload[0]?.payload;
                          if (!d) return null;
                          return (
                            <div className="rounded-xl border border-border bg-popover p-3 shadow-md text-xs text-popover-foreground space-y-1">
                              <p className="font-semibold text-foreground">{d.fullName}</p>
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                  <span className="size-2 rounded-full bg-[#2563EB]" />
                                  Successes:
                                </span>
                                <span className="font-bold text-[#2563EB]">{d.successes}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                  <span className="size-2 rounded-full bg-[#EF4444]" />
                                  Failures:
                                </span>
                                <span className="font-bold text-[#EF4444]">{d.failures}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                  <span className="size-2 rounded-full bg-[#F59E0B]" />
                                  Rate limited:
                                </span>
                                <span className="font-bold text-[#F59E0B]">{d.rateLimited}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4 border-t border-border pt-1">
                                <span className="text-muted-foreground">Total Invocations:</span>
                                <span className="font-bold text-foreground">{d.calls}</span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="successes" name="Successes" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="failures" name="Failures" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="rateLimited" name="Rate limited" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
                  <span>Displaying {chartData.length} organization{chartData.length === 1 ? "" : "s"} with recorded AI telemetry.</span>
                  <Link to="/ai-usage" className="font-medium text-primary hover:underline">
                    Full AI audit log →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">
                <p>No recorded AI invocations yet across customer organizations.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Column 2: Management Shortcuts */}
        <div className="space-y-4">
          {/* Shortcut 1: Organizations */}
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Organizations</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Review company workspaces, manage membership caps, and review suspended status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                to="/organizations"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "w-full justify-between text-xs cursor-pointer"
                )}
              >
                <span>Manage Organizations</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </CardContent>
          </Card>

          {/* Shortcut 2: Users */}
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <CardTitle className="text-sm font-semibold">User Directory</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Inspect user registrations, staff flags, search accounts, and manage credentials.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                to="/users"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "w-full justify-between text-xs cursor-pointer"
                )}
              >
                <span>Browse User Directory</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </CardContent>
          </Card>

          {/* Shortcut 3: AI Usage */}
          <Card className="rounded-xl border border-border bg-card shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <CardTitle className="text-sm font-semibold">AI Audit &amp; Tokens</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Track Pydantic AI usage, plan reviews, prompt token consumption, and cost estimates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                to="/ai-usage"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "w-full justify-between text-xs cursor-pointer"
                )}
              >
                <span>Audit AI Usage</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div className="rounded-xl border border-border/80 bg-muted/30 p-4 text-xs text-muted-foreground flex items-start gap-3">
        <Server className="size-4 shrink-0 text-muted-foreground mt-0.5" />
        <div>
          <strong className="font-semibold text-foreground">Operational Privacy &amp; Data Isolation:</strong> Customer weekly plan bodies and drafts are strictly scoped to customer tenant organizations and are never surfaced within the platform staff administration console.
        </div>
      </div>
    </div>
  );
}
