import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listOrganizations,
  suspendOrganization,
  reinstateOrganization,
} from "@/api/endpoints/organizations/organizations";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_main/organizations")({
  component: OrganizationsPage,
});

function OrganizationsPage() {
  const queryClient = useQueryClient();
  const organizations = useQuery({
    queryKey: ["internal-organizations"],
    queryFn: listOrganizations,
  });
  const suspend = useMutation({
    mutationFn: (id: string) => suspendOrganization(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["internal-organizations"] }),
  });
  const reinstate = useMutation({
    mutationFn: (id: string) => reinstateOrganization(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["internal-organizations"] }),
  });
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold">Organizations</h1>
        <p className="text-muted-foreground">
          Operational metadata only. Customer plan text is private.
        </p>
      </div>
      {organizations.isLoading && <p>Loading organizations…</p>}
      {organizations.isError && (
        <p className="text-red-700">Could not load organizations.</p>
      )}
      <div className="grid gap-4">
        {organizations.data?.map((org) => (
          <article key={org.id} className="rounded-xl border bg-background p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{org.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {org.slug} · {org.suspended_at ? "Suspended" : "Active"}
                </p>
              </div>
              {org.suspended_at ? (
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  disabled={reinstate.isPending}
                  onClick={() => reinstate.mutate(org.id)}
                >
                  Reinstate
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  className="cursor-pointer"
                  disabled={suspend.isPending}
                  onClick={() => suspend.mutate(org.id)}
                >
                  Suspend
                </Button>
              )}
            </div>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
              <p>
                <strong>{org.member_count}</strong> members
              </p>
              <p>
                <strong>{org.team_count}</strong> teams
              </p>
              <p>
                <strong>{org.plan_count}</strong> plans
              </p>
              <p>
                Last active:{" "}
                {org.last_active_at
                  ? new Date(org.last_active_at).toLocaleString()
                  : "No activity"}
              </p>
            </div>
          </article>
        ))}
      </div>
      {organizations.data?.length === 0 && <p>No organizations yet.</p>}
      {(suspend.isError || reinstate.isError) && (
        <p className="text-red-700">The organization could not be updated.</p>
      )}
    </div>
  );
}
