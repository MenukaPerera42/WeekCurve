import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  createInvite,
  listMembers,
  removeMember,
  updateMember,
  updateOrganization,
} from "@/api/endpoints/organizations/organizations";
import { useOrganization } from "@/contexts/organization-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/_main/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const isAdmin =
    organization?.role === "owner" || organization?.role === "admin";
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviteResult, setInviteResult] = useState<{
    organizationId: string;
    token: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setInviteResult(null);
    setCopied(false);
    setInviteRole("member");
  }, [orgId]);
  const members = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: () => listMembers(orgId),
    enabled: !!orgId,
  });
  const rename = useMutation({
    mutationFn: () => updateOrganization(orgId, { name }),
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: ["/organizations"] });
    },
  });
  const invite = useMutation({
    mutationFn: (invitationOrgId: string) =>
      createInvite(invitationOrgId, { email: email.trim(), role: inviteRole }),
    onSuccess: (result, invitationOrgId) => {
      setInviteResult({ organizationId: invitationOrgId, token: result.token });
      setCopied(false);
    },
  });
  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      updateMember(orgId, id, { role }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["org-members", orgId] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeMember(orgId, id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["org-members", orgId] }),
  });
  const invitationUrl = inviteResult?.organizationId === orgId
    ? `${window.location.origin}/signup?invite=${encodeURIComponent(inviteResult.token)}`
    : "";
  const error =
    rename.error || changeRole.error || remove.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">Organization</h1>
        <p className="text-muted-foreground">
          Members, invitations, and workspace settings.
        </p>
      </div>
      {!organization && <p>No active organization selected.</p>}
      {organization && (
        <>
          <section className="rounded-xl border border-border bg-card text-card-foreground p-5">
            <h2 className="text-lg font-semibold">{organization.name}</h2>
            <p className="text-sm text-muted-foreground">
              Your role: {organization.role}
            </p>
            {isAdmin && (
              <form
                className="mt-4 flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  rename.mutate();
                }}
              >
                <Input
                  className="max-w-sm"
                  aria-label="Organization name"
                  placeholder="New organization name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Button
                  type="submit"
                  className="cursor-pointer"
                  disabled={name.trim().length < 2 || rename.isPending}
                >
                  Rename
                </Button>
              </form>
            )}
          </section>
          <section className="rounded-xl border border-border bg-card text-card-foreground p-5">
            <h2 className="text-lg font-semibold">Members</h2>
            <div className="mt-3 divide-y divide-border">
              {members.isLoading && <p>Loading members…</p>}
              {members.data?.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div>
                    <strong>
                      {member.first_name} {member.last_name}
                    </strong>
                    <p className="text-sm text-muted-foreground">
                      {member.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm capitalize">{member.role}</span>
                    {organization.role === "owner" &&
                      member.role !== "owner" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer"
                          disabled={changeRole.isPending}
                          onClick={() =>
                            changeRole.mutate({
                              id: member.id,
                              role:
                                member.role === "admin" ? "member" : "admin",
                            })
                          }
                        >
                          {member.role === "admin"
                            ? "Make member"
                            : "Make admin"}
                        </Button>
                      )}
                    {isAdmin &&
                      member.role !== "owner" &&
                      (member.role !== "admin" ||
                        organization.role === "owner") && (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="cursor-pointer"
                          disabled={remove.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove ${member.first_name} from ${organization.name}?`
                              )
                            ) {
                              remove.mutate(member.id);
                            }
                          }}
                        >
                          Remove
                        </Button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </section>
          {isAdmin && (
            <section className="rounded-xl border border-border bg-card text-card-foreground p-5">
              <h2 className="text-lg font-semibold">Invite a teammate</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a private link for one email address. It expires after
                seven days.
              </p>
              <form
                className="mt-4 flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!orgId || invite.isPending || !email.trim()) return;
                  setInviteResult(null);
                  setCopied(false);
                  invite.mutate(orgId);
                }}
              >
                <Input
                  className="min-w-52 flex-1"
                  type="email"
                  required
                  placeholder="teammate@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (invite.isError) invite.reset();
                  }}
                />
                <select
                  aria-label="Invitation role"
                  className="rounded-md border border-input bg-background text-foreground px-3 py-2 cursor-pointer"
                  value={inviteRole}
                  onChange={(e) => {
                    setInviteRole(e.target.value);
                    if (invite.isError) invite.reset();
                  }}
                >
                  <option value="member">Member</option>
                  {organization.role === "owner" && (
                    <option value="admin">Admin</option>
                  )}
                </select>
                <Button
                  type="submit"
                  className="cursor-pointer"
                  disabled={!email.trim() || invite.isPending}
                >
                  Create invite
                </Button>
              </form>
              {invite.isError && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {invite.error instanceof ApiError
                    ? (invite.error.data as { detail?: { msg?: string }[] } | undefined)
                        ?.detail?.[0]?.msg ?? "Could not create the invitation. Please try again."
                    : "Network error. Please try again."}
                </p>
              )}
              {invitationUrl && (
                <div className="mt-4 rounded-lg border border-border bg-muted/50 text-foreground p-3">
                  <p className="text-sm font-medium">
                    Copy this invitation link
                  </p>
                  <p className="break-all text-sm">{invitationUrl}</p>
                  <Button
                    className="mt-2 cursor-pointer"
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(invitationUrl);
                      setCopied(true);
                    }}
                  >
                    {copied ? "Copied" : "Copy link"}
                  </Button>
                </div>
              )}
            </section>
          )}
          {error && (
            <p className="text-sm text-destructive">
              {error instanceof ApiError
                ? "The action could not be completed. Check the email or your permissions."
                : "Network error. Try again."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
