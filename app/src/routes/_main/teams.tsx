import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { teamDigest } from "@/api/endpoints/ai/ai";
import type { TeamDigest } from "@/api/model";
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
import { useCurrentUser } from "@/contexts/user-context";
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
  const user = useCurrentUser();
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
  const [digestResult, setDigestResult] = useState<{
    scope: string;
    data: TeamDigest;
  } | null>(null);
  const [digestError, setDigestError] = useState<{
    scope: string;
    message: string;
  } | null>(null);
  const digestVersion = useRef(0);
  const currentDigestScope = useRef("");
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
  const digestScope = JSON.stringify([
    orgId,
    activeTeamId,
    week,
    members.dataUpdatedAt,
    weekView.dataUpdatedAt,
  ]);
  if (currentDigestScope.current !== digestScope) {
    currentDigestScope.current = digestScope;
    digestVersion.current += 1;
  }
  useEffect(() => {
    setDigestResult(null);
    setDigestError(null);
  }, [digestScope]);
  const isTeamLead = !!user && members.data?.some(
    (member) => member.user_id === user.id && member.is_lead
  );
  const isMonday = /^\d{4}-\d{2}-\d{2}$/.test(week) &&
    new Date(`${week}T00:00:00`).getDay() === 1;
  const visibleDigest = digestResult?.scope === digestScope
    ? digestResult.data : null;
  const clearDigest = () => {
    digestVersion.current += 1;
    setDigestResult(null);
    setDigestError(null);
  };
  const digest = useMutation({
    mutationFn: ({ organizationId, selectedTeamId, weekStart }: {
      organizationId: string;
      selectedTeamId: string;
      weekStart: string;
      scope: string;
      version: number;
    }) => teamDigest(organizationId, selectedTeamId, weekStart),
    onSuccess: (data, request) => {
      if (currentDigestScope.current === request.scope &&
          digestVersion.current === request.version) {
        setDigestResult({ scope: request.scope, data });
      }
    },
    onError: (error, request) => {
      if (currentDigestScope.current !== request.scope ||
          digestVersion.current !== request.version) return;
      if (error instanceof ApiError) {
        if ([401, 403, 404].includes(error.status)) {
          setDigestError({ scope: request.scope,
            message: "You do not have access to this team's digest. Refresh your team selection." });
        } else if (error.status === 429) {
          setDigestError({ scope: request.scope,
            message: "AI is busy right now. Try again later." });
        } else if (error.status === 503) {
          const detail = error.data as { detail?: { msg?: string }[] } | undefined;
          setDigestError({ scope: request.scope,
            message: detail?.detail?.[0]?.msg ?? "AI is unavailable. Try again later." });
        } else {
          setDigestError({ scope: request.scope,
            message: "Could not generate the digest. Try again." });
        }
      } else {
        setDigestError({ scope: request.scope,
          message: "Network error. Check your connection and try again." });
      }
    },
  });
  const digestPending = digest.isPending && digest.variables?.scope === digestScope;
  const requestDigest = () => {
    if (!orgId || !activeTeamId || !isTeamLead || !isMonday ||
        !members.isSuccess || !weekView.isSuccess || digestPending) return;
    clearDigest();
    digest.mutate({
      organizationId: orgId,
      selectedTeamId: activeTeamId,
      weekStart: week,
      scope: digestScope,
      version: digestVersion.current,
    });
  };
  const refresh = () => {
    clearDigest();
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
        <h1 className="text-3xl font-semibold text-foreground">Teams</h1>
        <p className="text-muted-foreground">
          See the week, review plans, and keep everyone moving.
        </p>
      </div>
      {!organization && <p>Choose an organization to see its teams.</p>}
      {organization && (
        <>
          {isAdmin && (
            <section className="rounded-xl border border-border bg-card text-card-foreground p-5">
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
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {create.error instanceof ApiError
                    ? (create.error.data as { detail?: { msg?: string }[] } | undefined)
                        ?.detail?.[0]?.msg ?? "Could not create the team. Please try again."
                    : "Network error. Please try again."}
                </p>
              )}
            </section>
          )}
          <section className="rounded-xl border border-border bg-card text-card-foreground p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Team</h2>
              <select
                aria-label="Select team"
                className="rounded-md border border-input bg-background text-foreground px-3 py-2 cursor-pointer"
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
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card text-card-foreground px-3 py-2 text-sm"
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
                      className="flex-1 rounded-md border border-input bg-background text-foreground px-3 py-2 cursor-pointer"
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
            <section className="rounded-xl border border-border bg-card text-card-foreground p-5">
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
                  <p className="mt-4 rounded-lg border border-border text-muted-foreground p-4">
                    Only this team’s lead can view and approve its weekly plans.
                  </p>
                )}
              {weekView.isError &&
                !(
                  weekView.error instanceof ApiError &&
                  weekView.error.status === 404
                ) && (
                  <p className="mt-4 text-destructive">Could not load the week.</p>
                )}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {weekView.data?.map((item) => (
                  <button
                    type="button"
                    key={item.member_id}
                    disabled={!item.plan_id}
                    className="rounded-lg border border-border bg-card/60 text-card-foreground p-4 text-left transition hover:border-primary/50 disabled:opacity-60 cursor-pointer"
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
          <section className="rounded-xl border border-border bg-card text-card-foreground p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">AI Team Digest</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Generate a read-only summary of the team&apos;s selected week.
                </p>
                {selectedTeam && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedTeam.name} · Week starting {week}
                  </p>
                )}
              </div>
              {activeTeamId && isTeamLead && (
                <Button
                  type="button"
                  className="cursor-pointer"
                  disabled={!isMonday || !members.isSuccess ||
                    !weekView.isSuccess || digestPending}
                  onClick={requestDigest}
                >
                  {digestPending ? "Generating…" : "Generate Team Digest"}
                </Button>
              )}
            </div>
            {!activeTeamId && (
              <p className="mt-3 text-sm text-muted-foreground">
                Select a team to generate its digest.
              </p>
            )}
            {activeTeamId && members.isSuccess && !isTeamLead && (
              <p className="mt-3 text-sm text-muted-foreground">
                Only this team&apos;s lead can generate its digest.
              </p>
            )}
            {activeTeamId && isTeamLead && !isMonday && (
              <p className="mt-3 text-sm text-destructive">
                Select a Monday as the week starting date.
              </p>
            )}
            {activeTeamId && isTeamLead && weekView.isError && (
              <p className="mt-3 text-sm text-destructive">
                The team week could not be loaded. Refresh it before generating a digest.
              </p>
            )}
            {digestPending && (
              <p className="mt-3 text-sm text-muted-foreground" role="status">
                Gemini is preparing the team digest…
              </p>
            )}
            {digestError?.scope === digestScope && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {digestError.message}
              </p>
            )}
            {visibleDigest && (
              <div className="mt-4 space-y-4 text-sm" aria-live="polite">
                <div className="grid gap-3 rounded-lg border border-border bg-muted/50 text-foreground p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <p><strong>{visibleDigest.member_count}</strong> team members</p>
                  <p><strong>{visibleDigest.submitted_count}</strong> submitted plans</p>
                  <p><strong>{visibleDigest.missing_submissions.length}</strong> missing submissions</p>
                  <p><strong>{visibleDigest.done_count}</strong> completed plans</p>
                </div>
                {visibleDigest.submitted_count === 0 && (
                  <p className="rounded-lg border border-border p-3 text-muted-foreground">
                    No team plans have been submitted for this week yet.
                  </p>
                )}
                <div>
                  <h3 className="font-medium">Progress</h3>
                  <p className="mt-1 whitespace-pre-wrap">{visibleDigest.progress_summary}</p>
                  <p className="mt-2 text-muted-foreground">
                    {visibleDigest.awaiting_approval_count} awaiting approval ·{" "}
                    {visibleDigest.approved_count} approved ·{" "}
                    {visibleDigest.draft_count} drafts ·{" "}
                    {visibleDigest.not_started_count} not started
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">Missing submissions</h3>
                  {visibleDigest.missing_submissions.length ? (
                    <ul className="mt-2 list-inside list-disc space-y-1">
                      {visibleDigest.missing_submissions.map((member) => (
                        <li key={member.member_id}>
                          {member.name} · {member.status === "draft" ? "Draft" : "Not started"}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-1 text-muted-foreground">Everyone has submitted a plan.</p>}
                </div>
                <div>
                  <h3 className="font-medium">Incomplete or unshipped work</h3>
                  {visibleDigest.incomplete_work.length ? (
                    <ul className="mt-2 space-y-2">
                      {visibleDigest.incomplete_work.map((item) => (
                        <li key={item.evidence_id} className="rounded-lg border border-border p-3">
                          <strong>{visibleDigest.members.find(
                            (member) => member.member_id === item.member_id
                          )?.name}</strong>{" "}
                          · {item.detail}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-1 text-muted-foreground">No incomplete or unshipped work is recorded.</p>}
                </div>
                <div>
                  <h3 className="font-medium">Delivery risks</h3>
                  {visibleDigest.delivery_risks.length ? (
                    <ul className="mt-2 space-y-2">
                      {visibleDigest.delivery_risks.map((risk) => (
                        <li key={risk.evidence_id} className="rounded-lg border border-border p-3">
                          <strong>{visibleDigest.members.find(
                            (member) => member.member_id === risk.member_id
                          )?.name}</strong>{" "}
                          · {risk.detail}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-1 text-muted-foreground">No evidence-based risks selected.</p>}
                </div>
                <div>
                  <h3 className="font-medium">Recommended next actions</h3>
                  {visibleDigest.recommended_actions.length ? (
                    <ul className="mt-2 list-inside list-disc space-y-1">
                      {visibleDigest.recommended_actions.map((action, index) => (
                        <li key={`${index}-${action}`}>{action}</li>
                      ))}
                    </ul>
                  ) : <p className="mt-1 text-muted-foreground">No additional actions suggested.</p>}
                </div>
              </div>
            )}
          </section>
          {detail.data && (
            <section className="rounded-xl border border-border bg-card text-card-foreground p-5">
              <h2 className="font-semibold">
                Plan review · {detail.data.week_start}
              </h2>
              <p className="text-sm capitalize text-muted-foreground">
                {detail.data.status}
              </p>
              <ul className="mt-4 space-y-2">
                {detail.data.tasks.map((task) => (
                  <li key={task.id} className="rounded-lg border border-border p-3 text-sm">
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
            <p className="text-sm text-destructive">
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
