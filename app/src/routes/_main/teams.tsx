import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listTeams,
  createTeam,
  listTeamMembers,
  addTeamMember,
  setTeamLead,
  setPrimaryTeam,
} from "@/api/endpoints/teams/teams";
import { listMembers } from "@/api/endpoints/organizations/organizations";
import {
  teamWeek,
  getPlan,
  approvePlan,
  sendBackPlan,
} from "@/api/endpoints/plans/plans";
import { useOrganization } from "@/contexts/organization-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";

export const Route = createFileRoute("/_main/teams")({ component: TeamsPage });

function monday() {
  const date = new Date();
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function TeamsPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const isAdmin =
    organization?.role === "owner" || organization?.role === "admin";
  const queryClient = useQueryClient();
  const [teamId, setTeamId] = useState("");
  const [week, setWeek] = useState(monday);
  const [newName, setNewName] = useState("");
  const [addMemberId, setAddMemberId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [feedback, setFeedback] = useState("");
  const teams = useQuery({
    queryKey: ["teams", orgId],
    queryFn: () => listTeams(orgId),
    enabled: !!orgId,
  });
  const selectedTeam =
    teams.data?.find((team) => team.id === teamId) ?? teams.data?.[0];
  const activeTeamId = selectedTeam?.id ?? "";
  const members = useQuery({
    queryKey: ["team-members", orgId, activeTeamId],
    queryFn: () => listTeamMembers(orgId, activeTeamId),
    enabled: !!activeTeamId,
  });
  const orgMembers = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: () => listMembers(orgId),
    enabled: !!orgId && isAdmin,
  });
  const weekView = useQuery({
    queryKey: ["team-week", orgId, activeTeamId, week],
    queryFn: () => teamWeek(orgId, activeTeamId, week),
    enabled: !!activeTeamId,
    retry: false,
  });
  const detail = useQuery({
    queryKey: ["team-plan", orgId, selectedPlanId],
    queryFn: () => getPlan(orgId, selectedPlanId),
    enabled: !!selectedPlanId,
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["teams", orgId] });
    queryClient.invalidateQueries({ queryKey: ["team-members", orgId] });
    queryClient.invalidateQueries({ queryKey: ["team-week", orgId] });
    queryClient.invalidateQueries({ queryKey: ["team-plan", orgId] });
  };
  const create = useMutation({
    mutationFn: () => createTeam(orgId, { name: newName.trim() }),
    onSuccess: (team) => {
      setNewName("");
      setTeamId(team.id);
      refresh();
    },
  });
  const add = useMutation({
    mutationFn: () =>
      addTeamMember(orgId, activeTeamId, {
        member_id: addMemberId,
        is_primary: false,
      }),
    onSuccess: () => {
      setAddMemberId("");
      refresh();
    },
  });
  const lead = useMutation({
    mutationFn: (memberId: string) =>
      setTeamLead(orgId, activeTeamId, memberId),
    onSuccess: refresh,
  });
  const primary = useMutation({
    mutationFn: (memberId: string) =>
      setPrimaryTeam(orgId, activeTeamId, memberId),
    onSuccess: refresh,
  });
  const approve = useMutation({
    mutationFn: () =>
      approvePlan(orgId, selectedPlanId, { comment: feedback || null }),
    onSuccess: () => {
      setFeedback("");
      refresh();
    },
  });
  const sendBack = useMutation({
    mutationFn: () =>
      sendBackPlan(orgId, selectedPlanId, { comment: feedback }),
    onSuccess: () => {
      setFeedback("");
      refresh();
    },
  });
  const error =
    add.error ||
    lead.error ||
    primary.error ||
    approve.error ||
    sendBack.error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#111C30]">Teams</h1>
        <p className="text-muted-foreground">
          See the week, review plans, and keep everyone moving.
        </p>
      </div>
      {!organization && <p>Choose an organization to see its teams.</p>}
      {organization && (
        <>
          {isAdmin && (
            <section className="rounded-xl border bg-white p-5">
              <h2 className="font-semibold">Create a team</h2>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!orgId || create.isPending || newName.trim().length < 2) return;
                  create.mutate();
                }}
              >
                <Input
                  aria-label="New team name"
                  placeholder="Engineering"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (create.isError) create.reset();
                  }}
                />
                <Button
                  type="submit"
                  className="cursor-pointer"
                  disabled={newName.trim().length < 2 || create.isPending}
                >
                  Create
                </Button>
              </form>
              {create.isError && (
                <p role="alert" className="mt-2 text-sm text-red-700">
                  {create.error instanceof ApiError
                    ? (create.error.data as { detail?: { msg?: string }[] } | undefined)
                        ?.detail?.[0]?.msg ?? "Could not create the team. Please try again."
                    : "Network error. Please try again."}
                </p>
              )}
            </section>
          )}
          <section className="rounded-xl border bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Team</h2>
              <select
                aria-label="Select team"
                className="rounded-md border bg-white px-3 py-2 cursor-pointer"
                value={activeTeamId}
                onChange={(e) => {
                  setTeamId(e.target.value);
                  setSelectedPlanId("");
                }}
              >
                <option value="">Select a team</option>
                {teams.data?.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            {teams.isLoading && <p className="mt-3">Loading teams…</p>}
            {teams.data?.length === 0 && (
              <p className="mt-3 text-muted-foreground">
                No teams yet. An organization admin can create one.
              </p>
            )}
            {activeTeamId && (
              <div className="mt-5">
                <h3 className="font-medium">Members</h3>
                <ul className="mt-2 space-y-2">
                  {members.data?.map((m) => (
                    <li
                      key={m.member_id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                    >
                      <span>
                        {m.name} {m.is_lead && <strong>· Lead</strong>}{" "}
                        {m.is_primary && <span>· Primary team</span>}
                      </span>
                      {isAdmin && (
                        <span className="flex gap-2">
                          {!m.is_lead && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="cursor-pointer"
                              onClick={() => lead.mutate(m.member_id)}
                            >
                              Make lead
                            </Button>
                          )}
                          {!m.is_primary && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="cursor-pointer"
                              onClick={() => primary.mutate(m.member_id)}
                            >
                              Set primary
                            </Button>
                          )}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {isAdmin && (
                  <div className="mt-3 flex gap-2">
                    <select
                      aria-label="Add member"
                      className="flex-1 rounded-md border bg-white px-3 cursor-pointer"
                      value={addMemberId}
                      onChange={(e) => setAddMemberId(e.target.value)}
                    >
                      <option value="">Choose a member</option>
                      {orgMembers.data
                        ?.filter(
                          (m) =>
                            !members.data?.some((tm) => tm.member_id === m.id)
                        )
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.first_name} {m.last_name}
                          </option>
                        ))}
                    </select>
                    <Button
                      className="cursor-pointer"
                      disabled={!addMemberId || add.isPending}
                      onClick={() => add.mutate()}
                    >
                      Add
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>
          {activeTeamId && (
            <section className="rounded-xl border bg-white p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-semibold">The team’s week</h2>
                  <p className="text-sm text-muted-foreground">
                    Plans and progress at a glance.
                  </p>
                </div>
                <label className="text-sm">
                  Week starting{" "}
                  <Input
                    type="date"
                    value={week}
                    onChange={(e) => setWeek(e.target.value)}
                  />
                </label>
              </div>
              {weekView.isLoading && <p className="mt-4">Loading the week…</p>}
              {weekView.error instanceof ApiError &&
                weekView.error.status === 404 && (
                  <p className="mt-4 rounded-lg border p-4">
                    Only this team’s lead can view and approve its weekly plans.
                  </p>
                )}
              {weekView.isError &&
                !(
                  weekView.error instanceof ApiError &&
                  weekView.error.status === 404
                ) && (
                  <p className="mt-4 text-red-700">Could not load the week.</p>
                )}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {weekView.data?.map((item) => (
                  <button
                    type="button"
                    key={item.member_id}
                    disabled={!item.plan_id}
                    className="rounded-lg border p-4 text-left transition hover:border-[#243A59] disabled:opacity-60 cursor-pointer"
                    onClick={() => setSelectedPlanId(item.plan_id ?? "")}
                  >
                    <strong>{item.member_name}</strong>
                    <p className="mt-1 text-sm capitalize">
                      {item.status.replaceAll("_", " ")} · {item.tasks_done}/
                      {item.tasks_total} tasks
                    </p>
                    <p className="text-sm">
                      Goal shipped:{" "}
                      {item.main_shipped === null
                        ? "Not marked"
                        : item.main_shipped
                          ? "Yes"
                          : "No"}
                    </p>
                  </button>
                ))}
              </div>
              {weekView.data?.length === 0 && (
                <p className="mt-4 text-muted-foreground">
                  No members in this team yet.
                </p>
              )}
            </section>
          )}
          {detail.data && (
            <section className="rounded-xl border bg-white p-5">
              <h2 className="font-semibold">
                Plan review · {detail.data.week_start}
              </h2>
              <p className="text-sm capitalize text-muted-foreground">
                {detail.data.status}
              </p>
              <ul className="mt-4 space-y-2">
                {detail.data.tasks.map((task) => (
                  <li key={task.id} className="rounded-lg border p-3 text-sm">
                    <strong className="capitalize">
                      {task.kind.replaceAll("_", " ")}
                    </strong>
                    <p>{task.text}</p>
                    {task.why_it_matters && (
                      <p className="text-muted-foreground">
                        Why: {task.why_it_matters}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              {detail.data.status === "submitted" && (
                <>
                  <Input
                    className="mt-4"
                    aria-label="Approval feedback"
                    placeholder="Feedback for this plan"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                  />
                  <div className="mt-3 flex gap-2">
                    <Button
                      className="cursor-pointer"
                      disabled={approve.isPending}
                      onClick={() => approve.mutate()}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="cursor-pointer"
                      disabled={!feedback.trim() || sendBack.isPending}
                      onClick={() => sendBack.mutate()}
                    >
                      Send back
                    </Button>
                  </div>
                </>
              )}
            </section>
          )}
          {error && (
            <p className="text-sm text-red-700">
              {error instanceof ApiError
                ? "The request was refused. Check your role and the selected member."
                : "Network error. Try again."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
