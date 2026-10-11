import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  const [inviteToken, setInviteToken] = useState("");
  const [copied, setCopied] = useState(false);
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
    mutationFn: () => createInvite(orgId, { email, role: inviteRole }),
    onSuccess: (result) => {
      setInviteToken(result.token);
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
  const invitationUrl = inviteToken
    ? `${window.location.origin}/signup?invite=${encodeURIComponent(inviteToken)}`
    : "";
  const error =
    rename.error || invite.error || changeRole.error || remove.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#111C30]">Organization</h1>
        <p className="text-muted-foreground">
          Members, invitations, and workspace settings.
        </p>
      </div>
      {!organization && <p>No active organization selected.</p>}
      {organization && (
        <>
          <section className="rounded-xl border bg-white p-5">
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
                  className="cursor-pointer"
                  disabled={name.trim().length < 2 || rename.isPending}
                >
                  Rename
                </Button>
              </form>
            )}
          </section>
          <section className="rounded-xl border bg-white p-5">
            <h2 className="text-lg font-semibold">Members</h2>
            <div className="mt-3 divide-y">
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
            <section className="rounded-xl border bg-white p-5">
              <h2 className="text-lg font-semibold">Invite a teammate</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a private link for one email address. It expires after
                seven days.
              </p>
              <form
                className="mt-4 flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  invite.mutate();
                }}
              >
                <Input
                  className="min-w-52 flex-1"
                  type="email"
                  required
                  placeholder="teammate@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <select
                  aria-label="Invitation role"
                  className="rounded-md border bg-white px-3 cursor-pointer"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="member">Member</option>
                  {organization.role === "owner" && (
                    <option value="admin">Admin</option>
                  )}
                </select>
                <Button className="cursor-pointer" disabled={invite.isPending}>
                  Create invite
                </Button>
              </form>
              {invitationUrl && (
                <div className="mt-4 rounded-lg border bg-[#F7F9FC] p-3">
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
            <p className="text-sm text-red-700">
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
