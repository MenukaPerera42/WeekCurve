import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { aiUsage } from "@/api/endpoints/ai-usage/ai-usage";

export const Route = createFileRoute("/_main/ai-usage")({
  component: AIUsagePage,
});

function AIUsagePage() {
  const usage = useQuery({ queryKey: ["ai-usage"], queryFn: aiUsage });
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold">AI usage</h1>
        <p className="text-muted-foreground">
          Calls, failures, and rate limits by organization. No customer prompts
          are shown.
        </p>
      </div>
      {usage.isLoading && <p>Loading AI usage…</p>}
      {usage.isError && <p className="text-red-700">Could not load usage.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {usage.data?.map((row) => (
          <article
            key={row.organization_id}
            className="rounded-xl border bg-background p-5"
          >
            <h2 className="font-semibold">{row.organization_name}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <p>
                <strong>{row.calls}</strong> calls
              </p>
              <p>
                <strong>{row.successes}</strong> successes
              </p>
              <p>
                <strong>{row.failures}</strong> failures
              </p>
              <p>
                <strong>{row.rate_limited}</strong> rate limited
              </p>
            </div>
          </article>
        ))}
      </div>
      {usage.data?.length === 0 && <p>No organizations yet.</p>}
    </div>
  );
}
