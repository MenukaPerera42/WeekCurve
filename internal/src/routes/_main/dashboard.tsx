import { createFileRoute, Link } from "@tanstack/react-router";
import { useCurrentUser } from "@/contexts/user-context";
import { useUserList } from "@/api/endpoints/users/users";
import { useQuery } from "@tanstack/react-query";
import { listOrganizations } from "@/api/endpoints/organizations/organizations";
import { aiUsage } from "@/api/endpoints/ai-usage/ai-usage";
import {
  Users,
  Building2,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  ShieldAlert,
  Server,
  Activity,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_main/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const user = useCurrentUser();

  // Total users count from existing userList endpoint (limit 1 for efficiency)
  const usersQuery = useUserList({ limit: 1, offset: 0 });

  // Total organizations from existing listOrganizations endpoint
  const orgsQuery = useQuery({
    queryKey: ["admin-organizations"],
    queryFn: () => listOrganizations(),
  });

  // AI Usage summary from existing aiUsage endpoint
  const aiUsageQuery = useQuery({
    queryKey: ["admin-ai-usage"],
    queryFn: () => aiUsage(),
  });

  const totalUsers = usersQuery.data?.total;
  const totalOrgs = orgsQuery.data?.length;
  const activeOrgs = orgsQuery.data?.filter((o) => !o.is_suspended)?.length;
  const aiRequestsCount = aiUsageQuery.data?.length;

  return (
    <div className="space-y-8">
      {/* Top Header / Platform Operations Context */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Platform Administration
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md border border-sidebar-border bg-muted/60 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="size-3 text-primary" />
              Staff Console
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {user ? `Signed in as ${user.first_name} ${user.last_name}.` : "Welcome."} Manage platform organizations, users, and AI usage.
          </p>
        </div>
      </div>

      {/* Operational Metrics Cards */}
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

      {/* Management Shortcuts & System Operations Sections */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Shortcut 1: Organizations */}
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardHeader>
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
          <CardHeader>
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
          <CardHeader>
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
