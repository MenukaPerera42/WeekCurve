import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { myPlans } from "@/api/endpoints/plans/plans";
import { listTeams } from "@/api/endpoints/teams/teams";
import { useCurrentUser } from "@/contexts/user-context";
import { useOrganization } from "@/contexts/organization-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const Route = createFileRoute("/_main/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const user = useCurrentUser();
  const { organization, isLoading, isError } = useOrganization();
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
  const current = plans.data?.[0];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">
          Good to see you{user ? `, ${user.first_name}` : ""}.
        </h1>
        <p className="mt-1 text-muted-foreground">
          Plan the week. Ship the goal.
        </p>
      </div>
      {isLoading && <p>Loading your workspace…</p>}
      {isError && (
        <p className="text-destructive">Could not load your organizations.</p>
      )}
      {!isLoading && !organization && (
        <Card>
          <CardHeader>
            <CardTitle>No active organization</CardTitle>
          </CardHeader>
          <CardContent>
            Ask for an invitation or create a new account for your own
            organization.
          </CardContent>
        </Card>
      )}
      {organization && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your week</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold capitalize">
                  {current?.status ?? "Not started"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {current?.week_start ?? "Start with a clear outcome"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Teams</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {teams.data?.length ?? "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  In {organization.name}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your role</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold capitalize">
                  {organization.role}
                </p>
                <p className="text-sm text-muted-foreground">
                  Organization access
                </p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Make this week count</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Set one significant goal, name the outcomes that prove it
                shipped, and get a team lead’s approval.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  className={buttonVariants({ className: "cursor-pointer" })}
                  to="/plans"
                >
                  Open my plan
                </Link>
                <Link
                  className={buttonVariants({
                    variant: "outline",
                    className: "cursor-pointer",
                  })}
                  to="/teams"
                >
                  See the team’s week
                </Link>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
