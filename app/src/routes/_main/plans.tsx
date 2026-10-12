import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  endOfWeekSummary,
  generatePlan,
  lookBackBeforePlanning,
  reviewPlan,
} from "@/api/endpoints/ai/ai";
import {
  completeTask,
  finishPlan,
  myPlans,
  saveDraft,
  submitPlan,
} from "@/api/endpoints/plans/plans";
import type {
  LookbackAdvice,
  PlanResponse,
  PlanReview,
  WeeklySummary,
} from "@/api/model";
import { useOrganization } from "@/contexts/organization-context";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function mondayFor(dateStr?: string | null): string | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const parts = dateStr.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) return null;
  const d = new Date(year, month - 1, day, 12, 0, 0);
  if (isNaN(d.getTime())) return null;
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const part = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${part(d.getMonth() + 1)}-${part(d.getDate())}`;
}

function isValidMonday(dateStr?: string | null): boolean {
  return !!dateStr && mondayFor(dateStr) === dateStr;
}

type PlansSearch = {
  week?: string;
};

export const Route = createFileRoute("/_main/plans")({
  validateSearch: (search: Record<string, unknown>): PlansSearch => {
    const raw = typeof search["week"] === "string" ? (search["week"] as string) : undefined;
    return {
      week: mondayFor(raw) ?? undefined,
    };
  },
  component: PlansPage,
});

type DraftTask = {
  id: string;
  kind: "main" | "sub_goal" | "go_to_market";
  text: string;
  why_it_matters: string;
};
const emptyTasks = (): DraftTask[] => [
  { id: crypto.randomUUID(), kind: "main", text: "", why_it_matters: "" },
  { id: crypto.randomUUID(), kind: "sub_goal", text: "", why_it_matters: "" },
];

function thisMonday() {
  const day = new Date();
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  const part = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${part(day.getMonth() + 1)}-${part(day.getDate())}`;
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const data = error.data as { detail?: { msg?: string }[] } | undefined;
    return data?.detail?.[0]?.msg ?? "The request could not be completed.";
  }
  return "Network error. Try again.";
}

function reviewErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "Network error. Try the review again.";
  if (error.status === 401 || error.status === 403) return "Your access has changed. Sign in again or select an organization you can access.";
  if (error.status === 429) return "AI is busy. Try the review again later.";
  const data = error.data as { detail?: { type?: string; msg?: string }[] } | undefined;
  const detail = data?.detail?.[0];
  if (detail?.type === "ai_timeout") return "AI took too long. Try the review again later.";
  if (detail?.type === "ai_invalid_output") {
    return detail.msg ?? "AI returned an unusable review. Try again later.";
  }
  if (error.status === 422) return "The plan could not be reviewed. Check the task details and try again.";
  return "AI review is unavailable right now. Try again later.";
}

function PlansPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const searchWeek = search.week;
  const initialWeek = useMemo(() => {
    if (isValidMonday(searchWeek)) return searchWeek!;
    if (typeof window !== "undefined") {
      const param = new URLSearchParams(window.location.search).get("week");
      if (mondayFor(param)) return mondayFor(param)!;
    }
    return thisMonday();
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(initialWeek);
  const week = mondayFor(selectedDate) ?? "";

  const handleWeekChange = (newWeek: string) => {
    clearLookback();
    clearSummary();
    setSelectedDate(newWeek);
    const monday = mondayFor(newWeek);
    if (monday) {
      navigate({
        search: (prev) => ({ ...prev, week: monday }),
        replace: true,
      });
    }
  };

  useEffect(() => {
    if (searchWeek && isValidMonday(searchWeek) && searchWeek !== week) {
      clearLookback();
      clearSummary();
      setSelectedDate(searchWeek);
    }
  }, [searchWeek]);

  const [tasks, setTasks] = useState<DraftTask[]>(emptyTasks);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [notes, setNotes] = useState("");
  const [draftError, setDraftError] = useState<{
    scope: string;
    version: number;
    message: string;
  } | null>(null);
  const draftVersion = useRef(0);
  const currentDraftScope = useRef("");
  const [review, setReview] = useState<PlanReview | null>(null);
  const [reviewError, setReviewError] = useState("");
  const [lookbackAdvice, setLookbackAdvice] =
    useState<LookbackAdvice | null>(null);
  const [lookbackError, setLookbackError] = useState("");
  const lookbackVersion = useRef(0);
  const currentScope = useRef("");
  const [summaryExplanation, setSummaryExplanation] = useState("");
  const [weeklySummary, setWeeklySummary] = useState<{
    scope: string;
    data: WeeklySummary;
    editedNote: string;
  } | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const summaryVersion = useRef(0);
  const currentSummaryScope = useRef("");
  const [message, setMessage] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const plans = useQuery({
    queryKey: ["my-plans", orgId],
    queryFn: () => myPlans(orgId),
    enabled: !!orgId,
  });
  const selected = plans.data?.find((p) => p.week_start === week);
  const scopeKey = `${orgId}:${week}`;
  currentScope.current = scopeKey;
  const summaryScope = JSON.stringify([
    orgId,
    week,
    selected?.id ?? null,
    selected?.status ?? null,
    selected?.main_shipped ?? null,
    selected?.tasks.map((task) => [task.id, task.kind, task.text, task.is_done]) ?? [],
  ]);
  if (currentSummaryScope.current !== summaryScope) {
    currentSummaryScope.current = summaryScope;
    summaryVersion.current += 1;
    if (weeklySummary) setWeeklySummary(null);
    if (summaryError) setSummaryError("");
  }

  const selectedKey = `${orgId}:${week}:${selected?.id ?? "new"}:${selected?.status ?? ""}`;
  if (currentDraftScope.current !== selectedKey) {
    currentDraftScope.current = selectedKey;
    draftVersion.current += 1;
  }
  if (loadedKey !== selectedKey) {
    lookbackVersion.current += 1;
    setLoadedKey(selectedKey);
    setPlan(selected ?? null);
    setTasks(
      selected
        ? selected.tasks.map((t) => ({
            id: t.id,
            kind: t.kind as DraftTask["kind"],
            text: t.text,
            why_it_matters: t.why_it_matters ?? "",
          }))
        : emptyTasks()
    );
    setReview(null);
    setReviewError("");
    setLookbackAdvice(null);
    setLookbackError("");
    summaryVersion.current += 1;
    setWeeklySummary(null);
    setSummaryError("");
    setSummaryExplanation("");
    setMessage("");
  }

  function clearLookback() {
    lookbackVersion.current += 1;
    setLookbackAdvice(null);
    setLookbackError("");
  }

  function clearSummary() {
    summaryVersion.current += 1;
    setWeeklySummary(null);
    setSummaryError("");
  }

  const refresh = async (updated: PlanResponse) => {
    clearSummary();
    setPlan(updated);
    await queryClient.invalidateQueries({ queryKey: ["my-plans", orgId] });
    await queryClient.invalidateQueries({ queryKey: ["team-week", orgId] });
    await queryClient.invalidateQueries({ queryKey: ["team-plan", orgId] });
  };
  const save = useMutation({
    mutationFn: () =>
      saveDraft(orgId, week, {
        tasks: tasks
          .filter((t) => t.text.trim())
          .map((t) => ({
            kind: t.kind,
            text: t.text,
            why_it_matters: t.kind === "main" ? t.why_it_matters : null,
          })),
      }),
    onSuccess: refresh,
  });
  const submit = useMutation({
    mutationFn: () => submitPlan(orgId, plan?.id ?? ""),
    onSuccess: refresh,
  });
  const toggle = useMutation({
    mutationFn: (task: { id: string; done: boolean }) =>
      completeTask(orgId, plan?.id ?? "", task.id, { is_done: task.done }),
    onSuccess: refresh,
  });
  const finish = useMutation({
    mutationFn: (shipped: boolean) =>
      finishPlan(orgId, plan?.id ?? "", { main_shipped: shipped }),
    onSuccess: refresh,
  });
  const aiReview = useMutation({
    mutationFn: ({ organizationId, currentTasks }: {
      organizationId: string;
      currentTasks: DraftTask[];
      scope: string;
      version: number;
    }) => reviewPlan(organizationId, {
      tasks: currentTasks.filter((task) => task.text.trim()).map((task) => ({
        id: task.id,
        kind: task.kind,
        text: task.text,
        why_it_matters: task.why_it_matters || null,
      })),
    }),
    onSuccess: (result, request) => {
      if (currentDraftScope.current === request.scope &&
          draftVersion.current === request.version) {
        setReview(result);
        setReviewError("");
      }
    },
    onError: (error, request) => {
      if (currentDraftScope.current === request.scope &&
          draftVersion.current === request.version) {
        setReviewError(reviewErrorMessage(error));
      }
    },
  });

  function requestReview() {
    if (!orgId || !editable || busy) return;
    setReviewError("");
    setReview(null);
    aiReview.mutate({ organizationId: orgId, currentTasks: tasks,
      scope: selectedKey, version: draftVersion.current });
  }
  const aiDraft = useMutation({
    mutationFn: ({ organizationId, requestNotes }: {
      organizationId: string;
      requestNotes: string;
      scope: string;
      version: number;
    }) => generatePlan(organizationId, { notes: requestNotes }),
    onSuccess: (result, request) => {
      if (currentDraftScope.current !== request.scope ||
          draftVersion.current !== request.version) {
        return;
      }
      clearLookback();
      clearSummary();
      setTasks(
        result.tasks.map((t) => ({
          id: crypto.randomUUID(),
          kind: t.kind,
          text: t.text,
          why_it_matters: t.why_it_matters ?? "",
        }))
      );
      setReview(null);
      setReviewError("");
      setDraftError(null);
      setMessage("Draft added to the form. Edit it before saving.");
    },
    onError: (error, request) => {
      if (currentDraftScope.current === request.scope &&
          draftVersion.current === request.version) {
        setDraftError({ scope: request.scope, version: request.version,
          message: errorMessage(error) });
      }
    },
  });

  function requestDraft() {
    const requestNotes = notes.trim();
    if (!orgId || !editable || !plans.isSuccess || busy ||
        requestNotes.length < 15 || requestNotes.length > 5000) {
      return;
    }
    if (tasks.some((task) => task.text.trim() || task.why_it_matters.trim()) &&
        !window.confirm("Replace your current unsaved plan edits with an AI draft?")) {
      return;
    }
    setDraftError(null);
    aiDraft.mutate({
      organizationId: orgId,
      requestNotes,
      scope: selectedKey,
      version: draftVersion.current,
    });
  }
  const aiLookback = useMutation({
    mutationFn: ({ organizationId, weekStart }: {
      organizationId: string;
      weekStart: string;
      version: number;
    }) => lookBackBeforePlanning(organizationId, weekStart),
    onSuccess: (advice, request) => {
      if (
        currentScope.current === `${request.organizationId}:${request.weekStart}` &&
        lookbackVersion.current === request.version
      ) {
        setLookbackAdvice(advice);
      }
    },
    onError: (error, request) => {
      if (
        currentScope.current === `${request.organizationId}:${request.weekStart}` &&
        lookbackVersion.current === request.version
      ) {
        setLookbackError(errorMessage(error));
      }
    },
  });

  function requestLookback() {
    if (!orgId || aiLookback.isPending) return;
    clearLookback();
    aiLookback.mutate({
      organizationId: orgId,
      weekStart: week,
      version: lookbackVersion.current,
    });
  }

  const aiSummary = useMutation({
    mutationFn: ({ organizationId, planId, explanation }: {
      organizationId: string;
      planId: string;
      weekStart: string;
      scope: string;
      version: number;
      explanation: string;
    }) => endOfWeekSummary(
      organizationId,
      planId,
      explanation ? { unfinished_explanation: explanation } : {},
    ),
    onSuccess: (result, request) => {
      if (
        currentSummaryScope.current === request.scope &&
        orgId === request.organizationId &&
        week === request.weekStart &&
        summaryVersion.current === request.version
      ) {
        setWeeklySummary({ scope: request.scope, data: result, editedNote: result.summary });
      }
    },
    onError: (error, request) => {
      if (
        currentSummaryScope.current === request.scope &&
        orgId === request.organizationId &&
        week === request.weekStart &&
        summaryVersion.current === request.version
      ) {
        setSummaryError(errorMessage(error));
      }
    },
  });

  function requestSummary() {
    if (!orgId || !plan || !selected || plan.id !== selected.id ||
        aiSummary.isPending || busy || summaryExplanation.length > 1000) return;
    clearSummary();
    aiSummary.mutate({
      organizationId: orgId,
      planId: plan.id,
      weekStart: week,
      scope: summaryScope,
      version: summaryVersion.current,
      explanation: summaryExplanation.trim(),
    });
  }

  function updateTask(id: string, changes: Partial<DraftTask>) {
    draftVersion.current += 1;
    clearLookback();
    clearSummary();
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, ...changes } : task))
    );
    setReview(null);
    setReviewError("");
  }
  function addTask(kind: DraftTask["kind"]) {
    draftVersion.current += 1;
    clearLookback();
    clearSummary();
    setTasks((current) => [
      ...current,
      { id: crypto.randomUUID(), kind, text: "", why_it_matters: "" },
    ]);
    setReview(null);
    setReviewError("");
  }
  const visibleSummary = weeklySummary?.scope === summaryScope ? weeklySummary : null;
  const savedPlanSelected = !!plan && selected?.id === plan.id && plan.week_start === week;
  const busy =
    save.isPending ||
    submit.isPending ||
    toggle.isPending ||
    finish.isPending ||
    aiReview.isPending ||
    aiDraft.isPending;
  const actionError =
    save.error ||
    submit.error ||
    toggle.error ||
    finish.error;
  const editable = !plan || plan.status === "draft" || plan.status === "submitted";
  const savingBlocked = save.isPending || submit.isPending || toggle.isPending ||
    finish.isPending || aiDraft.isPending;
  const saveDisabledReason = !week
    ? "Choose a valid calendar date to save this week's draft."
    : aiDraft.isPending
      ? "Wait for the AI draft to finish before saving."
      : savingBlocked
        ? "Wait for the current plan update to finish before saving."
        : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">
            My weekly plan
          </h1>
          <p className="text-muted-foreground">
            One clear goal, a few outcomes, and a Friday finish.
          </p>
        </div>
        <label className="text-sm">
          Planning date{" "}
          <Input
            className="mt-1"
            type="date"
            value={selectedDate}
            onChange={(e) => handleWeekChange(e.target.value)}
          />
          {week && (
            <span className="mt-1 block text-xs text-muted-foreground">
              Week starts Monday {week}
            </span>
          )}
        </label>
      </div>
      {!organization && (
        <div className="rounded-lg border border-border bg-card text-card-foreground p-6">
          {plans.isLoading
            ? "Loading your organization…"
            : "Join or create an organization to plan your week."}
        </div>
      )}
      {organization && (
        <>
          <section className="rounded-xl border border-border bg-card text-card-foreground p-5">
            <h2 className="text-lg font-semibold">Look back before planning</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review your previous two weeks for unfinished work and get ideas
              for a realistic plan. Suggestions stay here until you choose what
              to do.
            </p>
            <Button
              variant="outline"
              className="mt-4 cursor-pointer"
              disabled={
                aiLookback.isPending ||
                busy ||
                plans.isLoading ||
                !week ||
                new Date(`${week}T12:00:00`).getDay() !== 1
              }
              onClick={requestLookback}
            >
              {aiLookback.isPending ? "Looking back…" : "Look back with AI"}
            </Button>
            {lookbackError && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {lookbackError} You can keep planning manually.
              </p>
            )}
            {lookbackAdvice && (
              <div className="mt-4 space-y-4 text-sm" aria-live="polite">
                {lookbackAdvice.previous_weeks.length === 0 ? (
                  <p className="rounded-lg bg-muted/50 text-foreground p-3">
                    No previous plans yet. {lookbackAdvice.message}
                  </p>
                ) : (
                  <>
                    <p>{lookbackAdvice.message}</p>
                    <div>
                      <h3 className="font-semibold">Previous weeks reviewed</h3>
                      <ul className="mt-1 list-inside list-disc">
                        {lookbackAdvice.previous_weeks.map((previousWeek) => (
                          <li key={previousWeek}>{previousWeek}</li>
                        ))}
                      </ul>
                    </div>
                    {lookbackAdvice.repeated_work.length > 0 && (
                      <div>
                        <h3 className="font-semibold">Repeated unfinished work</h3>
                        <ul className="mt-2 space-y-3">
                          {lookbackAdvice.repeated_work.map((item, index) => (
                            <li
                              key={index}
                              className="rounded-lg bg-muted/50 text-foreground p-3"
                            >
                              <p className="font-medium">{item.description}</p>
                              <ul className="mt-2 list-inside list-disc text-muted-foreground">
                                {item.evidence.map((reference) => {
                                  const previousPlan = plans.data?.find(
                                    (candidate) => candidate.id === reference.plan_id
                                  );
                                  const previousTask = previousPlan?.tasks.find(
                                    (candidate) => candidate.id === reference.task_id
                                  );
                                  return (
                                    <li key={`${reference.plan_id}:${reference.task_id}`}>
                                      {previousPlan?.week_start ?? "Previous plan"}: {" "}
                                      {previousTask?.text ?? "Unfinished task"}
                                    </li>
                                  );
                                })}
                              </ul>
                              <p className="mt-2">
                                <strong>Try:</strong> {item.suggested_adjustment}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {lookbackAdvice.repeated_work.length === 0 && (
                      <p>No repeated unfinished work was identified.</p>
                    )}
                    {lookbackAdvice.planning_adjustments.length > 0 && (
                      <div>
                        <h3 className="font-semibold">Planning adjustments</h3>
                        <ul className="mt-1 list-inside list-disc">
                          {lookbackAdvice.planning_adjustments.map(
                            (adjustment, index) => (
                              <li key={index}>{adjustment}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
          <div className="rounded-xl border border-border bg-card text-card-foreground p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Plan for {week}</h2>
              <span className="rounded-full bg-secondary text-secondary-foreground px-3 py-1 text-sm capitalize font-medium">
                {plan?.status ?? "Not started"}
              </span>
            </div>
            {plans.isLoading && <p className="mt-3">Loading plans…</p>}
            {plans.isError && (
              <p className="mt-3 text-destructive">Could not load plans.</p>
            )}
            <div className="mt-5 space-y-5">
              {tasks.map((task) => (
                <div key={task.id} className="rounded-lg border border-border bg-card/50 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold capitalize">
                      {task.kind.replaceAll("_", " ")}
                    </span>
                    {editable && task.kind !== "main" && (
                      <button
                        type="button"
                        className="cursor-pointer text-sm text-destructive"
                        onClick={() => {
                          draftVersion.current += 1;
                          clearLookback();
                          clearSummary();
                          setTasks((all) => all.filter((t) => t.id !== task.id));
                          setReview(null);
                          setReviewError("");
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {editable ? (
                    <>
                      <Textarea
                        aria-label={`${task.kind} task`}
                        value={task.text}
                        placeholder="Describe a result you can verify"
                        onChange={(e) =>
                          updateTask(task.id, { text: e.target.value })
                        }
                      />
                      {task.kind === "main" && (
                        <Input
                          className="mt-2"
                          aria-label="Why this matters"
                          placeholder="Why does this goal matter?"
                          value={task.why_it_matters}
                          onChange={(e) =>
                            updateTask(task.id, {
                              why_it_matters: e.target.value,
                            })
                          }
                        />
                      )}
                    </>
                  ) : (
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id={`task-${task.id}`}
                        className="mt-1 size-4 rounded border-border text-primary cursor-pointer accent-primary shrink-0"
                        disabled={plan?.status !== "approved" || busy}
                        checked={
                          plan?.tasks.find((t) => t.id === task.id)?.is_done ??
                          false
                        }
                        onChange={(e) =>
                          toggle.mutate({ id: task.id, done: e.target.checked })
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <label
                          htmlFor={`task-${task.id}`}
                          className={`cursor-pointer ${
                            plan?.tasks.find((t) => t.id === task.id)?.is_done
                              ? "line-through text-muted-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {task.text}
                        </label>
                        {task.why_it_matters && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            Why: {task.why_it_matters}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {review?.findings
                    .filter((f) => f.task_id === task.id)
                    .map((finding, index) => (
                      <div
                        key={index}
                        className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-200"
                      >
                        <p>{finding.problem}</p>
                        <p className="mt-2 font-medium">
                          Try: {finding.suggested_rewrite}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 cursor-pointer"
                          onClick={() => {
                            draftVersion.current += 1;
                            clearLookback();
                            clearSummary();
                            setTasks((current) =>
                              current.map((item) =>
                                item.id === task.id
                                   ? { ...item, text: finding.suggested_rewrite }
                                  : item
                              )
                            );
                            setReview((current) =>
                              current
                                ? {
                                    ...current,
                                    findings: current.findings.filter(
                                      (item) => item !== finding
                                    ),
                                  }
                                : null
                            );
                            setReviewError("");
                          }}
                        >
                          Apply suggestion
                        </Button>
                      </div>
                    ))}
                </div>
              ))}
            </div>
            {plan?.status === "submitted" && (
              <p className="mt-4 text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border/50">
                You can revise this plan before approval. Saving reopens it as a draft;
                submit it again when ready for your team lead to review.
              </p>
            )}
            {(plan?.status === "approved" || plan?.status === "done") && (
              <p className="mt-4 text-xs text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border/50">
                This plan&apos;s structure is locked after approval. Select another week to create or edit a draft.
              </p>
            )}
            {editable && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => addTask("sub_goal")}
                >
                  Add sub-goal
                </Button>
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => addTask("go_to_market")}
                >
                  Add go-to-market goal
                </Button>
              </div>
            )}
            {review && (
              <p className="mt-4 text-sm">
                AI review:{" "}
                <strong>
                  {review.verdict === "approve"
                    ? "Ready to submit"
                    : "Adjust these tasks"}
                </strong>
              </p>
            )}
            {reviewError && (
              <p className="mt-4 text-sm text-destructive" role="alert">{reviewError}</p>
            )}
            {actionError && (
              <p className="mt-4 text-sm text-destructive">
                {errorMessage(actionError)}
              </p>
            )}
            {message && (
              <p className="mt-4 text-sm text-success">{message}</p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {editable && (
                <>
                  <Button
                    type="button"
                    className="cursor-pointer"
                    disabled={!!saveDisabledReason}
                    onClick={() => save.mutate()}
                  >
                    {save.isPending ? "Saving…" : "Save draft"}
                  </Button>
                  <Button
                    variant="outline"
                    className="cursor-pointer"
                    disabled={busy}
                    onClick={requestReview}
                  >
                    {aiReview.isPending ? "Reviewing…" : "Review with AI"}
                  </Button>
                </>
              )}
              {editable && saveDisabledReason && (
                <p className="w-full text-sm text-muted-foreground" role="status">
                  {saveDisabledReason}
                </p>
              )}
              {plan?.status === "draft" && (
                <Button
                  variant="secondary"
                  className="cursor-pointer"
                  disabled={busy}
                  onClick={() => submit.mutate()}
                >
                  Submit for approval
                </Button>
              )}
              {plan?.status === "approved" && (
                <>
                  <Button
                    variant="outline"
                    className="cursor-pointer"
                    disabled={busy}
                    onClick={() => finish.mutate(true)}
                  >
                    Finish: goal shipped
                  </Button>
                  <Button
                    variant="outline"
                    className="cursor-pointer"
                    disabled={busy}
                    onClick={() => finish.mutate(false)}
                  >
                    Finish: not shipped
                  </Button>
                </>
              )}
            </div>
          </div>
          <section className="rounded-xl border border-border bg-card text-card-foreground p-5">
            <h2 className="text-lg font-semibold">End-of-week Summary</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate a short note from your saved plan and recorded task progress.
              Task completion and the main goal’s shipped status are reported separately.
              The note stays editable here and is not saved automatically.
            </p>
            {!savedPlanSelected ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Save a plan for this week before generating a summary.
              </p>
            ) : (
              <>
                <label className="mt-4 block text-sm font-medium" htmlFor="summary-explanation">
                  Reason for unfinished work (optional)
                </label>
                <Textarea
                  id="summary-explanation"
                  className="mt-2"
                  maxLength={1000}
                  value={summaryExplanation}
                  placeholder="Add a reason only if you know it."
                  onChange={(event) => {
                    clearSummary();
                    setSummaryExplanation(event.target.value);
                  }}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {summaryExplanation.length}/1000 characters. This explanation is sent only
                  when you generate the summary.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 cursor-pointer"
                  disabled={aiSummary.isPending || busy || plans.isLoading}
                  onClick={requestSummary}
                >
                  {aiSummary.isPending ? "Generating…" : "Generate AI Summary"}
                </Button>
              </>
            )}
            {summaryError && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {summaryError} You can keep planning normally.
              </p>
            )}
            {visibleSummary && (
              <div className="mt-5 space-y-4 text-sm" aria-live="polite">
                <div className="rounded-lg bg-muted/50 text-foreground p-4">
                  <h3 className="font-semibold">What shipped</h3>
                  <p className="mt-1">
                    {visibleSummary.data.main_goal_shipped === true
                      ? visibleSummary.data.shipped_main_goal ?? "Main goal shipped."
                      : visibleSummary.data.main_goal_shipped === false
                        ? "The main goal did not ship."
                        : "The main goal’s shipped outcome has not been recorded."}
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="font-semibold">Completed tasks</h3>
                    {visibleSummary.data.completed_tasks.length ? (
                      <ul className="mt-2 list-inside list-disc space-y-1">
                        {visibleSummary.data.completed_tasks.map((task) => (
                          <li key={task.id}>{task.text}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-muted-foreground">No tasks are marked complete.</p>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold">What remains incomplete</h3>
                    {visibleSummary.data.incomplete_tasks.length ? (
                      <ul className="mt-2 list-inside list-disc space-y-1">
                        {visibleSummary.data.incomplete_tasks.map((task) => (
                          <li key={task.id}>{task.text}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-muted-foreground">No tasks remain incomplete.</p>
                    )}
                  </div>
                </div>
                {(visibleSummary.data.incomplete_tasks.length > 0 ||
                  visibleSummary.data.main_goal_shipped === false) && (
                  <p>
                    <strong>Known reason:</strong>{" "}
                    {visibleSummary.data.known_reason ?? "No reason was provided."}
                  </p>
                )}
                {visibleSummary.data.next_week_follow_up && (
                  <p>
                    <strong>Possible next-week follow-up:</strong>{" "}
                    {visibleSummary.data.next_week_follow_up}
                  </p>
                )}
                <div>
                  <label className="block font-semibold" htmlFor="editable-summary-note">
                    Editable AI-generated note (local only)
                  </label>
                  <Textarea
                    id="editable-summary-note"
                    className="mt-2"
                    value={visibleSummary.editedNote}
                    onChange={(event) => setWeeklySummary((current) =>
                      current && current.scope === summaryScope
                        ? { ...current, editedNote: event.target.value }
                        : current
                    )}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Edit this note freely. Changes are not saved to the plan.
                  </p>
                </div>
              </div>
            )}
          </section>
          {editable && (
            <section className="rounded-xl border border-border bg-card text-card-foreground p-5">
              <h2 className="text-lg font-semibold">Start from a brain dump</h2>
              <p className="mb-3 text-sm text-muted-foreground">
                Paste rough notes. The suggested plan stays editable until you
                save it.
              </p>
              <Textarea
                aria-label="Brain dump notes"
                maxLength={5000}
                value={notes}
                onChange={(e) => {
                  draftVersion.current += 1;
                  setDraftError(null);
                  setNotes(e.target.value);
                }}
                placeholder="Need to finish billing, fix the webhook, and announce the update…"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Enter at least 15 characters after trimming ({notes.trim().length}/5000).
                {" "}Existing unsaved plan edits require confirmation before replacement.
              </p>
              <Button
                type="button"
                className="mt-3 cursor-pointer"
                variant="outline"
                disabled={!plans.isSuccess || busy || notes.trim().length < 15 ||
                  notes.trim().length > 5000}
                onClick={requestDraft}
              >
                {aiDraft.isPending ? "Making a draft…" : "Make a draft"}
              </Button>
              {draftError?.scope === selectedKey &&
                draftError.version === draftVersion.current && (
                <p className="mt-3 text-sm text-destructive" role="alert">
                  {draftError.message} You can retry or keep editing manually.
                </p>
              )}
            </section>
          )}
          {!editable && (
            <p className="text-sm text-muted-foreground">
              Brain dump drafts are available before submission or while this plan is a draft.
            </p>
          )}
          {plan?.events.length ? (
            <section className="rounded-xl border border-border bg-card text-card-foreground p-5">
              <h2 className="font-semibold">History</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {plan.events.map((event, i) => (
                  <li key={i}>
                    <span className="capitalize">
                      {event.action.replaceAll("_", " ")}
                    </span>{" "}
                    · {new Date(event.created_at).toLocaleString()}
                    {event.comment && ` — ${event.comment}`}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section>
            <h2 className="mb-3 font-semibold">Past weeks</h2>
            <div className="flex flex-wrap gap-2">
              {plans.data?.map((p) => (
                <Button
                  key={p.id}
                  variant={week === p.week_start ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleWeekChange(p.week_start)}
                >
                  {p.week_start} · {p.status}
                </Button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
