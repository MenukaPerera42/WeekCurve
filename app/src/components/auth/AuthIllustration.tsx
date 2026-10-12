import {
  CalendarDays,
  CheckCircle2,
  ListTodo,
  Rocket,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";

/**
 * Original WeekCurve Authentication Illustration:
 * "From Monday Planning to Friday Shipping"
 *
 * Visualizes the core product loop:
 * Setting a Monday main goal -> lead approval -> task execution -> Friday shipped outcome.
 * Completely responsive and fully adaptive to both light and dark themes.
 */
export function AuthIllustration() {
  return (
    <div
      aria-hidden="true"
      className="relative flex h-full w-full select-none flex-col justify-between overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-muted/60 via-card to-muted/40 p-8 lg:p-12"
    >
      {/* Ambient background decoration with subtle grid and gradient orbs */}
      <div className="pointer-events-none absolute inset-0">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-[0.03]" />

        {/* Soft radial glow orbs */}
        <div className="absolute -left-16 -top-16 size-80 rounded-full bg-primary/10 blur-3xl dark:bg-primary/20" />
        <div className="absolute -bottom-20 -right-20 size-96 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-500/15" />
      </div>

      {/* Top Header Badge */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium text-foreground shadow-xs backdrop-blur-md">
          <Sparkles className="size-3.5 text-primary" />
          <span>The Weekly Execution Arc</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <CalendarDays className="size-3.5" />
          <span>Mon &rarr; Fri</span>
        </div>
      </div>

      {/* Main Interactive Diagram Section */}
      <div className="relative z-10 my-auto py-6">
        {/* The Flowing WeekCurve SVG Path */}
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 460 300"
          fill="none"
        >
          <defs>
            <linearGradient id="weekcurveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-primary, #2563eb)" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.9" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background guide glow curve */}
          <path
            d="M 50 60 C 180 30, 160 210, 390 190"
            stroke="url(#weekcurveGradient)"
            strokeWidth="6"
            strokeLinecap="round"
            className="opacity-20 blur-xs"
          />

          {/* Main glowing curved path */}
          <path
            d="M 50 60 C 180 30, 160 210, 390 190"
            stroke="url(#weekcurveGradient)"
            strokeWidth="2.5"
            strokeDasharray="4 4"
            className="opacity-70"
          />

          {/* Milestone nodes along the curve */}
          <circle cx="50" cy="60" r="5" className="fill-primary" />
          <circle cx="210" cy="120" r="4.5" className="fill-indigo-500" />
          <circle cx="390" cy="190" r="5.5" className="fill-emerald-500" />
        </svg>

        {/* Floating UI Cards */}
        <div className="relative grid gap-4 sm:grid-cols-2">
          {/* Card 1: Monday Goal Setting & Lead Approval */}
          <div className="relative -rotate-1 rounded-2xl border border-border bg-card/90 p-4 shadow-md backdrop-blur-md transition-all hover:rotate-0 hover:shadow-lg dark:bg-card/80">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                <span className="size-2 rounded-full bg-primary" />
                Monday
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="size-3" />
                Lead Approved
              </span>
            </div>
            <p className="mt-2.5 text-xs font-semibold text-foreground">
              Main Goal
            </p>
            <p className="text-xs text-muted-foreground">
              Ship sprint deliverables & verify team roadmap
            </p>
            <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
              <span>Clarity Score</span>
              <span className="font-semibold text-foreground">98% (High)</span>
            </div>
          </div>

          {/* Card 2: AI Review & Digest Helper */}
          <div className="relative translate-y-3 rotate-1 rounded-2xl border border-border bg-card/90 p-4 shadow-md backdrop-blur-md transition-all hover:translate-y-2 hover:rotate-0 hover:shadow-lg dark:bg-card/80">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="size-3.5 text-amber-500" />
                AI Plan Critique
              </span>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Pydantic AI
              </span>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              &ldquo;Tasks are specific, measurable, and tied to the main weekly outcome.&rdquo;
            </p>
            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" />
              <span>0 ambiguous items detected</span>
            </div>
          </div>

          {/* Card 3: Task Execution Checklist */}
          <div className="relative translate-y-2 -rotate-0.5 rounded-2xl border border-border bg-card/90 p-4 shadow-md backdrop-blur-md transition-all hover:shadow-lg dark:bg-card/80">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <ListTodo className="size-3.5 text-primary" />
                Tasks
              </span>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                4 / 4 Complete
              </span>
            </div>

            <div className="mt-2.5 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                <span className="line-through opacity-75">Customer auth & session guard</span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                <span className="line-through opacity-75">Weekly plan approval workflow</span>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                <span className="line-through opacity-75">AI team digest generation</span>
              </div>
            </div>

            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-full rounded-full bg-emerald-500 transition-all duration-500" />
            </div>
          </div>

          {/* Card 4: Friday Goal Shipped Outcome */}
          <div className="relative -translate-y-1 rotate-1 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-card to-emerald-500/5 p-4 shadow-md backdrop-blur-md transition-all hover:rotate-0 hover:shadow-lg">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                <Rocket className="size-3.5" />
                Friday
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Goal Shipped
              </span>
            </div>

            <p className="mt-2.5 text-xs font-semibold text-foreground">
              Weekly Result
            </p>
            <p className="text-xs text-muted-foreground">
              All commitments delivered on time and verified with lead.
            </p>

            <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[11px]">
              <span className="flex items-center gap-1 text-muted-foreground">
                <TrendingUp className="size-3 text-emerald-500" />
                Delivery confidence
              </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">100%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer Quote */}
      <div className="relative z-10 border-t border-border/80 pt-5">
        <p className="text-base font-semibold tracking-tight text-foreground">
          &ldquo;Plan the week. Ship the goal.&rdquo;
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Clear weekly commitments, team lead visibility, and AI-assisted plan reviews.
        </p>
      </div>
    </div>
  );
}

