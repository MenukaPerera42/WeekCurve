import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Menu,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const appUrl = import.meta.env["VITE_APP_URL"] || "http://localhost:3001";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WeekCurve — Plan the week. Ship the goal." },
      {
        name: "description",
        content:
          "Weekly planning for software teams that want clear goals, useful approvals, and a Friday finish.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "WeekCurve" },
      { property: "og:title", content: "WeekCurve — Plan the week. Ship the goal." },
      {
        property: "og:description",
        content:
          "Weekly planning for software teams that want clear goals, useful approvals, and a Friday finish.",
      },
      { property: "og:image", content: "/og-weekcurve.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "WeekCurve — Plan the week. Ship the goal." },
      {
        name: "twitter:description",
        content:
          "Weekly planning for software teams that want clear goals, useful approvals, and a Friday finish.",
      },
      { name: "twitter:image", content: "/og-weekcurve.png" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiDemoApplied, setAiDemoApplied] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* ─────────────────────────────────────────────────────────────────────────
          1. NAVIGATION
          ───────────────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-md transition-colors">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="/" className="inline-flex items-center gap-2" aria-label="WeekCurve Home">
            <Logo className="h-8 w-auto" />
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-7 md:flex text-sm font-medium text-muted-foreground" aria-label="Main Navigation">
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How It Works
            </a>
            <a href="#ai-review" className="transition-colors hover:text-foreground">
              AI Review
            </a>
            <a href="#for-teams" className="transition-colors hover:text-foreground">
              For Teams
            </a>
            <a href="#preview" className="transition-colors hover:text-foreground">
              Product Preview
            </a>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden items-center gap-3 md:flex">
            <ThemeToggle variant="compact" />
            <a
              href={`${appUrl}/login`}
              className="rounded-lg px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Sign In
            </a>
            <a
              href={`${appUrl}/signup`}
              className={cn(
                buttonVariants({ size: "sm" }),
                "h-8 rounded-lg px-3.5 text-xs font-semibold shadow-xs cursor-pointer gap-1.5"
              )}
            >
              Get Started
              <ArrowRight className="size-3.5" />
            </a>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle variant="compact" />
            <button
              type="button"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-foreground cursor-pointer"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="border-b border-border bg-background px-4 pb-6 pt-3 md:hidden">
            <nav className="flex flex-col space-y-3 text-sm font-medium">
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-muted-foreground hover:text-foreground"
              >
                How It Works
              </a>
              <a
                href="#ai-review"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-muted-foreground hover:text-foreground"
              >
                AI Review
              </a>
              <a
                href="#for-teams"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-muted-foreground hover:text-foreground"
              >
                For Teams
              </a>
              <a
                href="#preview"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 text-muted-foreground hover:text-foreground"
              >
                Product Preview
              </a>
              <div className="flex flex-col gap-2 pt-3 border-t border-border">
                <a
                  href={`${appUrl}/login`}
                  className="rounded-lg border border-border py-2 text-center text-xs font-semibold text-foreground hover:bg-muted"
                >
                  Sign In
                </a>
                <a
                  href={`${appUrl}/signup`}
                  className={cn(
                    buttonVariants({ size: "default" }),
                    "rounded-lg text-xs font-semibold justify-center gap-1.5"
                  )}
                >
                  Get Started <ArrowRight className="size-3.5" />
                </a>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main>
        {/* ─────────────────────────────────────────────────────────────────────────
            2. HERO SECTION
            ───────────────────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-32">
          {/* Subtle decorative glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
          >
            <div className="relative left-[calc(50%-11rem)] aspect-1155/678 w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-linear-to-tr from-blue-600/15 to-indigo-600/10 opacity-60 sm:left-[calc(50%-20rem)] sm:w-[72.1875rem]" />
          </div>

          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            {/* Expressive Supporting Hero Label */}
            <div className="inline-flex items-center gap-2 text-sm font-medium italic tracking-wide text-muted-foreground sm:text-base">
              <Sparkles className="size-3.5 sm:size-4 text-primary shrink-0 not-italic" />
              <span>AI-Assisted Weekly Planning for Software Teams</span>
            </div>

            {/* Main Headline */}
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Plan the week.{" "}
              <span className="block text-muted-foreground font-semibold sm:inline">
                Ship the goal.
              </span>
            </h1>

            {/* Supporting Copy */}
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Weekly planning for software teams that want clear goals, useful approvals, and a Friday finish.
            </p>

            {/* Call To Actions */}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <a
                href={`${appUrl}/signup`}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-11 rounded-xl px-6 text-sm font-semibold shadow-xs cursor-pointer gap-2"
                )}
              >
                Get started with WeekCurve
                <ArrowRight className="size-4" />
              </a>
              <a
                href="#how-it-works"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-semibold text-foreground shadow-2xs transition-colors hover:bg-muted"
              >
                See how it works
              </a>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Built for small software teams · No credit card required
            </p>

            {/* ─────────────────────────────────────────────────────────────────────────
                3. PRODUCT VISUAL PREVIEW
                ───────────────────────────────────────────────────────────────────────── */}
            <div id="preview" className="mt-12 sm:mt-16 scroll-mt-24">
              <div className="relative mx-auto max-w-6xl rounded-2xl border border-border bg-card p-3 shadow-xl sm:p-5">
                {/* Mock Window Top Bar */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full bg-red-400/80" />
                    <span className="size-3 rounded-full bg-amber-400/80" />
                    <span className="size-3 rounded-full bg-emerald-400/80" />
                    <span className="ml-2 text-xs font-medium text-muted-foreground">
                      WeekCurve · Core Engineering · Week of 12 Oct
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-600/25 bg-blue-600/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/15 dark:text-blue-300">
                      <ShieldCheck className="size-3" />
                      Approved by Team Lead
                    </span>
                  </div>
                </div>

                {/* Dashboard Inner Container */}
                <div className="grid gap-4 text-left sm:grid-cols-3">
                  {/* Left 2 Cols: Main Goal & Task Checklist */}
                  <div className="space-y-4 sm:col-span-2">
                    {/* Main Shippable Goal Card */}
                    <div className="rounded-xl border border-border bg-muted/40 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Main Shippable Goal
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-100 dark:bg-slate-100 dark:text-slate-900">
                          <Check className="size-3" /> Shipped
                        </span>
                      </div>
                      <h3 className="mt-2 text-base font-semibold text-foreground sm:text-lg">
                        Ship reliable checkout recovery flow
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Why it matters: Customers recover from failed subscription charges on staging without losing their basket.
                      </p>
                    </div>

                    {/* Task Checklist */}
                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center justify-between pb-3 border-b border-border/60">
                        <span className="text-xs font-semibold text-foreground">
                          Sub-Goals & Go-To-Market Tasks
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                          4 of 4 completed
                        </span>
                      </div>

                      <div className="mt-3 space-y-2.5">
                        <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/30 p-2.5 text-xs">
                          <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                            <Check className="size-3" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-foreground line-through opacity-80">
                              Expired cards handled on staging, confirmed by automated tests
                            </span>
                            <span className="ml-2 rounded border border-border bg-card px-1.5 py-0.2 text-[10px] text-muted-foreground">
                              Sub-goal
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/30 p-2.5 text-xs">
                          <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                            <Check className="size-3" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-foreground line-through opacity-80">
                              Payment retry webhook emits alert telemetry
                            </span>
                            <span className="ml-2 rounded border border-border bg-card px-1.5 py-0.2 text-[10px] text-muted-foreground">
                              Sub-goal
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/30 p-2.5 text-xs">
                          <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                            <Check className="size-3" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-foreground line-through opacity-80">
                              Publish payment recovery release notes & changelog entry
                            </span>
                            <span className="ml-2 rounded border border-border bg-card px-1.5 py-0.2 text-[10px] text-muted-foreground">
                              Go-to-market
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/30 p-2.5 text-xs">
                          <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                            <Check className="size-3" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-foreground line-through opacity-80">
                              Feature flag enabled for beta organizations
                            </span>
                            <span className="ml-2 rounded border border-border bg-card px-1.5 py-0.2 text-[10px] text-muted-foreground">
                              Go-to-market
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Weekly Status & Delivery Health */}
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-muted/40 p-4">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Delivery Velocity
                      </span>
                      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                        100%
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        All planned outcomes shipped
                      </p>

                      <div className="mt-4 space-y-2 border-t border-border/70 pt-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Plan Status:</span>
                          <span className="font-semibold text-foreground">Done</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Reviewer:</span>
                          <span className="font-medium text-foreground">Alex (Lead)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Outcome Date:</span>
                          <span className="font-medium text-foreground">Friday 4:30 PM</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <Bot className="size-3.5 text-primary" />
                        <span>AI Plan Assistant</span>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Plan reviewed by Gemini Flash-Lite. All tasks met verifiable outcome standards before submission.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────────
            4. HOW IT WORKS
            ───────────────────────────────────────────────────────────────────────── */}
        <section id="how-it-works" className="border-t border-border/80 bg-muted/30 py-20 scroll-mt-16 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                The Domain Workflow
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                A simple rhythm that holds from Monday to Friday.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
                No endless sprint planning meetings or neglected task backlogs. Just one agreed plan per engineer every week.
              </p>
            </div>

            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {/* Step 1 */}
              <div className="relative rounded-2xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm">
                      1
                    </span>
                    <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      Monday Morning
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-foreground">
                    Plan your Monday
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    Pick one significant thing to ship and state why it matters. Break it into a few verifiable sub-goals and go-to-market tasks that put work in front of users.
                  </p>
                </div>

                <div className="mt-6 rounded-lg border border-border/80 bg-muted/40 p-3 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Target className="size-3.5 text-primary shrink-0" />
                    <span>Main Goal: Ship Checkout Recovery</span>
                  </div>
                  <div className="text-muted-foreground pl-5 text-[11px]">
                    Sub-goals + GTM release checklist
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative rounded-2xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm">
                      2
                    </span>
                    <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      Monday Afternoon
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-foreground">
                    Get your lead’s approval
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    Submit your plan before Monday gets away. Your team lead signs off or sends it back with concise notes, ensuring the scope fits comfortably in one week.
                  </p>
                </div>

                <div className="mt-6 rounded-lg border border-border/80 bg-muted/40 p-3 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <ShieldCheck className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>Lead Feedback & Approval</span>
                  </div>
                  <div className="text-muted-foreground pl-5 text-[11px]">
                    Plan transitions: Draft → Submitted → Approved
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative rounded-2xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm">
                      3
                    </span>
                    <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      Friday Afternoon
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-foreground">
                    Track & ship by Friday
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    Tick off verifiable outcomes as you complete them during the week. At Friday close, mark whether your main goal shipped without carrying unfinished work forward.
                  </p>
                </div>

                <div className="mt-6 rounded-lg border border-border/80 bg-muted/40 p-3 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <CheckCircle2 className="size-3.5 text-slate-900 dark:text-slate-100 shrink-0" />
                    <span>Shipped Outcome Verified</span>
                  </div>
                  <div className="text-muted-foreground pl-5 text-[11px]">
                    Goal shipped: Yes · End the week on a high note
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────────
            5. AI REVIEW DEMONSTRATION (Mandatory Requirement)
            ───────────────────────────────────────────────────────────────────────── */}
        <section id="ai-review" className="border-t border-border/80 py-20 scroll-mt-16 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground shadow-2xs">
                  <Bot className="size-3.5 text-primary" />
                  <span>The Approval Meeting in a Box</span>
                </div>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  Catch vague tasks before your lead has to.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Before submitting, send your plan to our AI reviewer powered by Google’s Gemini Flash-Lite. It checks that every task describes a verifiable result rather than open-ended activity, that your main goal has clear business rationale, and that scope fits in a week.
                </p>

                <div className="mt-6 space-y-3 text-xs text-muted-foreground sm:text-sm">
                  <div className="flex items-start gap-2.5">
                    <Check className="size-4 text-primary shrink-0 mt-0.5" />
                    <span>Structured typed output powered by Pydantic AI — never raw unvalidated text.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="size-4 text-primary shrink-0 mt-0.5" />
                    <span>Concrete suggested rewrites you can inspect and apply with one click.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check className="size-4 text-primary shrink-0 mt-0.5" />
                    <span>Draft from rough brain dump notes when Monday morning starts messy.</span>
                  </div>
                </div>

                <div className="mt-8">
                  <a
                    href={`${appUrl}/signup`}
                    className={cn(
                      buttonVariants({ size: "default" }),
                      "rounded-xl px-5 text-xs font-semibold shadow-xs cursor-pointer gap-2"
                    )}
                  >
                    Try AI Plan Review Free
                    <ArrowRight className="size-3.5" />
                  </a>
                </div>
              </div>

              {/* Rendered Interactive Example */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-7">
                <div className="flex items-center justify-between border-b border-border/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Plan Review Finding
                    </span>
                  </div>
                  <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    Gemini Flash-Lite
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {/* Task Input Box */}
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Original Task in Plan
                    </label>
                    <div className="mt-1.5 rounded-lg border border-border bg-muted/30 p-3 text-xs font-medium text-foreground">
                      {aiDemoApplied ? (
                        <span className="font-semibold text-blue-700 dark:text-blue-300">
                          “Checkout handles expired cards on staging, verified by automated tests.”
                        </span>
                      ) : (
                        <span className="line-through decoration-destructive text-muted-foreground">
                          “Implement checkout”
                        </span>
                      )}
                    </div>
                  </div>

                  {/* AI Finding Card */}
                  <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-xs dark:border-amber-400/20 dark:bg-amber-400/5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-700 dark:text-amber-300">
                        Finding: Activity without checkable result
                      </span>
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-200">
                        Adjust
                      </span>
                    </div>
                    <p className="mt-1.5 text-muted-foreground">
                      “This describes an activity rather than a checkable result. The team cannot verify whether checkout is complete without an objective acceptance criteria.”
                    </p>
                  </div>

                  {/* AI Suggested Rewrite Card */}
                  <div className="rounded-xl border border-blue-600/25 bg-blue-600/5 p-4 text-xs dark:border-blue-400/20 dark:bg-blue-400/5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-blue-700 dark:text-blue-300">
                        Suggested Concrete Rewrite
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        Ready to apply
                      </span>
                    </div>
                    <p className="mt-1.5 font-medium text-foreground">
                      “Checkout handles expired cards on staging, verified by automated tests.”
                    </p>

                    <div className="mt-3 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setAiDemoApplied(!aiDemoApplied)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-2xs transition-opacity hover:opacity-90 cursor-pointer"
                      >
                        <Check className="size-3.5" />
                        {aiDemoApplied ? "Revert to original" : "Apply suggestion (1-click)"}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-center text-[11px] text-muted-foreground">
                  Interactive demonstration · Output shaped into verified Pydantic schema
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────────
            6. TEAM LEAD BENEFITS
            ───────────────────────────────────────────────────────────────────────── */}
        <section id="for-teams" className="border-t border-border/80 bg-muted/30 py-20 scroll-mt-16 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Team Lead Visibility
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                The team’s week at a glance.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
                Leads pick any week and immediately see who submitted, what’s approved, how many tasks are done, and whose goal shipped.
              </p>
            </div>

            {/* KPI Metric Summary Bar */}
            <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              <div className="rounded-xl border border-border bg-card p-4 text-center shadow-xs">
                <p className="text-xs font-medium text-muted-foreground">Submitted Plans</p>
                <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">4 / 4</p>
                <p className="mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">100% on Monday</p>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 text-center shadow-xs">
                <p className="text-xs font-medium text-muted-foreground">Approved Plans</p>
                <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">4 / 4</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">All leads signed off</p>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 text-center shadow-xs">
                <p className="text-xs font-medium text-muted-foreground">Tasks Completed</p>
                <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">15 / 16</p>
                <p className="mt-0.5 text-[11px] text-blue-600 dark:text-blue-400 font-medium">94% progress</p>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 text-center shadow-xs">
                <p className="text-xs font-medium text-muted-foreground">Main Goals Shipped</p>
                <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">4 / 4</p>
                <p className="mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Friday target met</p>
              </div>
            </div>

            {/* Realistic Team Member Week Cards */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Sarah Jenkins</h3>
                    <p className="text-xs text-muted-foreground">Frontend Engineer</p>
                  </div>
                  <span className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-100 dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900">
                    Done
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
                  <span className="text-muted-foreground">4 / 4 tasks completed</span>
                  <span className="font-medium text-foreground">Goal shipped: <strong>Yes</strong></span>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Marcus Vance</h3>
                    <p className="text-xs text-muted-foreground">Backend Engineer</p>
                  </div>
                  <span className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-100 dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900">
                    Done
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
                  <span className="text-muted-foreground">4 / 4 tasks completed</span>
                  <span className="font-medium text-foreground">Goal shipped: <strong>Yes</strong></span>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Elena Rostova</h3>
                    <p className="text-xs text-muted-foreground">Systems Architect</p>
                  </div>
                  <span className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-100 dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900">
                    Done
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
                  <span className="text-muted-foreground">3 / 4 tasks completed</span>
                  <span className="font-medium text-foreground">Goal shipped: <strong>Yes</strong></span>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">David Chen</h3>
                    <p className="text-xs text-muted-foreground">Staff Engineer</p>
                  </div>
                  <span className="rounded-md border border-blue-600/25 bg-blue-600/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/15 dark:text-blue-300">
                    Approved
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
                  <span className="text-muted-foreground">4 / 4 tasks completed</span>
                  <span className="font-medium text-foreground">Goal shipped: <strong>Yes</strong></span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────────
            7. FINAL CTA
            ───────────────────────────────────────────────────────────────────────── */}
        <section className="border-t border-border/80 py-20 sm:py-28">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-12 text-center shadow-xl sm:px-12 sm:py-16">
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                Make Friday easier to answer for.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Give your team one place to write clear plans, get leads to sign off on Monday, and celebrate real shipped outcomes by Friday afternoon.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                <a
                  href={`${appUrl}/signup`}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "h-12 rounded-xl px-7 text-sm font-semibold shadow-xs cursor-pointer gap-2"
                  )}
                >
                  Start planning with WeekCurve
                  <ArrowRight className="size-4" />
                </a>
                <a
                  href={`${appUrl}/login`}
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-background px-6 text-sm font-semibold text-foreground shadow-2xs transition-colors hover:bg-muted"
                >
                  Sign in to workspace
                </a>
              </div>

              <p className="mt-5 text-xs text-muted-foreground">
                Tenancy isolated per organization · AI reviews built on Google Gemini Flash-Lite
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ─────────────────────────────────────────────────────────────────────────
          8. FOOTER
          ───────────────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/80 bg-background py-12 text-xs text-muted-foreground transition-colors">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
            {/* Brand Column */}
            <div className="space-y-3 sm:col-span-2 md:col-span-1">
              <Logo className="h-7 w-auto" />
              <p className="text-xs text-muted-foreground">
                Plan the week. Ship the goal.
              </p>
              <p className="text-[11px] text-muted-foreground/80">
                AI-assisted weekly planning SaaS for small software engineering teams.
              </p>
            </div>

            {/* Product Links */}
            <div>
              <p className="font-semibold text-foreground text-xs uppercase tracking-wider">
                Product
              </p>
              <ul className="mt-3 space-y-2">
                <li>
                  <a href="#how-it-works" className="hover:text-foreground transition-colors">
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="#ai-review" className="hover:text-foreground transition-colors">
                    AI Plan Review
                  </a>
                </li>
                <li>
                  <a href="#for-teams" className="hover:text-foreground transition-colors">
                    Team Lead Visibility
                  </a>
                </li>
                <li>
                  <a href="#preview" className="hover:text-foreground transition-colors">
                    Dashboard Preview
                  </a>
                </li>
              </ul>
            </div>

            {/* Access */}
            <div>
              <p className="font-semibold text-foreground text-xs uppercase tracking-wider">
                Access
              </p>
              <ul className="mt-3 space-y-2">
                <li>
                  <a href={`${appUrl}/signup`} className="hover:text-foreground transition-colors">
                    Customer Sign Up
                  </a>
                </li>
                <li>
                  <a href={`${appUrl}/login`} className="hover:text-foreground transition-colors">
                    Customer Sign In
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-foreground transition-colors">
                    Monday Checklist
                  </a>
                </li>
                <li>
                  <a href="#for-teams" className="hover:text-foreground transition-colors">
                    Friday Completion
                  </a>
                </li>
              </ul>
            </div>

            {/* Foundation */}
            <div>
              <p className="font-semibold text-foreground text-xs uppercase tracking-wider">
                Foundation
              </p>
              <ul className="mt-3 space-y-2">
                <li>
                  <span className="text-foreground">Gemini Flash-Lite</span>
                </li>
                <li>
                  <span className="text-foreground">Pydantic AI</span>
                </li>
                <li>
                  <span className="text-foreground">TanStack Start & Router</span>
                </li>
                <li>
                  <span className="text-foreground">Multi-Tenant Isolation</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 sm:flex-row">
            <p className="text-[11px] text-muted-foreground">
              © {new Date().getFullYear()} WeekCurve. All rights reserved. Plan the week. Ship the goal.
            </p>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-muted-foreground font-medium">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Gemini Telemetry Active
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
