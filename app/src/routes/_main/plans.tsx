import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
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
import type { LookbackAdvice, PlanResponse, PlanReview } from "@/api/model";
import { useOrganization } from "@/contexts/organization-context";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_main/plans")({ component: PlansPage });

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

function PlansPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const queryClient = useQueryClient();
  const [week, setWeek] = useState(thisMonday);
  const [tasks, setTasks] = useState<DraftTask[]>(emptyTasks);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [notes, setNotes] = useState("");
  const [review, setReview] = useState<PlanReview | null>(null);
  const [lookbackAdvice, setLookbackAdvice] =
    useState<LookbackAdvice | null>(null);
  const [lookbackError, setLookbackError] = useState("");
  const lookbackVersion = useRef(0);
  const currentScope = useRef("");
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

  const selectedKey = `${orgId}:${week}:${selected?.id ?? "new"}:${selected?.status ?? ""}`;
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
    setLookbackAdvice(null);
    setLookbackError("");
    setMessage("");
  }

  function clearLookback() {
    lookbackVersion.current += 1;
    setLookbackAdvice(null);
    setLookbackError("");
  }

  const refresh = async (updated: PlanResponse) => {
    setPlan(updated);
    await queryClient.invalidateQueries({ queryKey: ["my-plans", orgId] });
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
    mutationFn: () =>
      reviewPlan(orgId, {
        tasks: tasks
          .filter((t) => t.text.trim())
          .map((t) => ({
            id: t.id,
            kind: t.kind,
            text: t.text,
            why_it_matters: t.why_it_matters || null,
          })),
      }),
    onSuccess: setReview,
  });
  const aiDraft = useMutation({
    mutationFn: () => generatePlan(orgId, { notes }),
    onSuccess: (result) => {
      clearLookback();
      setTasks(
        result.tasks.map((t) => ({
          id: crypto.randomUUID(),
          kind: t.kind,
          text: t.text,
          why_it_matters: t.why_it_matters ?? "",
        }))
      );
      setReview(null);
      setMessage("Draft added to the form. Edit it before saving.");
    },
  });
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

  function updateTask(id: string, changes: Partial<DraftTask>) {
    clearLookback();
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, ...changes } : task))
    );
    setReview(null);
  }
  function addTask(kind: DraftTask["kind"]) {
    clearLookback();
    setTasks((current) => [
      ...current,
      { id: crypto.randomUUID(), kind, text: "", why_it_matters: "" },
    ]);
  }
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
    finish.error ||
    aiReview.error ||
    aiDraft.error;
  const editable = !plan || plan.status === "draft";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[#111C30]">
            My weekly plan
          </h1>
          <p className="text-muted-foreground">
            One clear goal, a few outcomes, and a Friday finish.
          </p>
        </div>
        <label className="text-sm">
          Week starting Monday{" "}
          <Input
            className="mt-1"
            type="date"
            value={week}
            onChange={(e) => {
              clearLookback();
              setWeek(e.target.value);
            }}
          />
        </label>
      </div>
      {!organization && (
        <div className="rounded-lg border p-6">
          {plans.isLoading
            ? "Loading your organization…"
            : "Join or create an organization to plan your week."}
        </div>
      )}
      {organization && (
        <>
          <section className="rounded-xl border bg-white p-5">
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
              <p className="mt-3 text-sm text-red-700" role="alert">
                {lookbackError} You can keep planning manually.
              </p>
            )}
            {lookbackAdvice && (
              <div className="mt-4 space-y-4 text-sm" aria-live="polite">
                {lookbackAdvice.previous_weeks.length === 0 ? (
                  <p className="rounded-lg bg-[#F7F9FC] p-3">
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
                              className="rounded-lg bg-[#F7F9FC] p-3"
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
          <div className="rounded-xl border bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Plan for {week}</h2>
              <span className="rounded-full bg-[#DDE4ED] px-3 py-1 text-sm capitalize">
                {plan?.status ?? "Not started"}
              </span>
            </div>
            {plans.isLoading && <p className="mt-3">Loading plans…</p>}
            {plans.isError && (
              <p className="mt-3 text-red-700">Could not load plans.</p>
            )}
            <div className="mt-5 space-y-5">
              {tasks.map((task) => (
                <div key={task.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold capitalize">
                      {task.kind.replaceAll("_", " ")}
                    </span>
                    {editable && task.kind !== "main" && (
                      <button
                        type="button"
                        className="cursor-pointer text-sm text-red-700"
                        onClick={() => {
                          clearLookback();
                          setTasks((all) => all.filter((t) => t.id !== task.id));
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
                        className="mt-1 cursor-pointer"
                        disabled={plan?.status !== "approved" || busy}
                        checked={
                          plan?.tasks.find((t) => t.id === task.id)?.is_done ??
                          false
                        }
                        onChange={(e) =>
                          toggle.mutate({ id: task.id, done: e.target.checked })
                        }
                      />
                      <div>
                        <p>{task.text}</p>
                        {task.why_it_matters && (
                          <p className="text-sm text-muted-foreground">
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
                        className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"
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
                            clearLookback();
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
                          }}
                        >
                          Apply suggestion
                        </Button>
                      </div>
                    ))}
                </div>
              ))}
            </div>
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
            {actionError && (
              <p className="mt-4 text-sm text-red-700">
                {errorMessage(actionError)}
              </p>
            )}
            {message && (
              <p className="mt-4 text-sm text-green-700">{message}</p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {editable && (
                <>
                  <Button
                    className="cursor-pointer"
                    disabled={
                      busy ||
                      week === "" ||
                      new Date(`${week}T12:00:00`).getDay() !== 1
                    }
                    onClick={() => save.mutate()}
                  >
                    {save.isPending ? "Saving…" : "Save draft"}
                  </Button>
                  <Button
                    variant="outline"
                    className="cursor-pointer"
                    disabled={busy}
                    onClick={() => aiReview.mutate()}
                  >
                    {aiReview.isPending ? "Reviewing…" : "Review with AI"}
                  </Button>
                </>
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
          {editable && (
            <section className="rounded-xl border bg-white p-5">
              <h2 className="text-lg font-semibold">Start from a brain dump</h2>
              <p className="mb-3 text-sm text-muted-foreground">
                Paste rough notes. The suggested plan stays editable until you
                save it.
              </p>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Need to finish billing, fix the webhook, and announce the update…"
              />
              <Button
                className="mt-3 cursor-pointer"
                variant="outline"
                disabled={busy || notes.length < 15}
                onClick={() => aiDraft.mutate()}
              >
                {aiDraft.isPending ? "Making a draft…" : "Make a draft"}
              </Button>
            </section>
          )}
          {plan?.events.length ? (
            <section className="rounded-xl border bg-white p-5">
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
                  onClick={() => setWeek(p.week_start)}
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
