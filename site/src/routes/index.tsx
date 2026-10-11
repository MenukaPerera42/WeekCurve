import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  MessageSquareText,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";

const appUrl = import.meta.env["VITE_APP_URL"] || "http://localhost:3001";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WeekCurve — Plan the week. Ship the goal." },
      {
        name: "description",
        content:
          "A weekly planning home for small software teams. Set one shippable goal, get a lead’s approval, and track what actually shipped.",
      },
      {
        property: "og:title",
        content: "WeekCurve — Plan the week. Ship the goal.",
      },
      {
        property: "og:description",
        content:
          "Weekly plans, team approvals, and a clear Friday finish for small software teams.",
      },
      { property: "og:image", content: "/og-weekcurve.png" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#111C30]">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <Logo className="h-9 w-auto" />
        <a
          className="rounded-lg border border-[#AAB5C3] px-4 py-2 text-sm font-medium transition hover:bg-white cursor-pointer"
          href={`${appUrl}/login`}
        >
          Sign in
        </a>
      </header>
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 pt-10 sm:px-8 md:grid-cols-2 md:pt-20">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#243A59]">
              For small software teams
            </p>
            <h1 className="max-w-xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Plan the week.
              <br />
              <span className="text-[#586C87]">Ship the goal.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-[#243A59]">
              WeekCurve gives every engineer one clear weekly outcome, a lead
              who signs off, and a place to show what shipped by Friday.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                className={buttonVariants({
                  size: "lg",
                  className: "cursor-pointer",
                })}
                href={`${appUrl}/signup`}
              >
                Get started <ArrowRight className="size-4" />
              </a>
              <span className="text-sm text-[#586C87]">
                Start with your team. No setup call.
              </span>
            </div>
          </div>
          <div className="rounded-3xl border border-[#DDE4ED] bg-white p-5 shadow-[0_24px_80px_-40px_#243A59] sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#607089]">
                  Engineering · This week
                </p>
                <h2 className="mt-1 text-xl font-semibold">
                  Ship reliable checkout recovery
                </h2>
              </div>
              <span className="rounded-full bg-[#DDE4ED] px-3 py-1 text-xs font-semibold">
                Approved
              </span>
            </div>
            <p className="mt-2 text-sm text-[#607089]">
              Why it matters: customers can recover from failed payments.
            </p>
            <div className="mt-6 space-y-3">
              {[
                "Expired cards handled on staging",
                "Recovery flow passes end-to-end tests",
                "Changelog entry is published",
              ].map((item, i) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-xl bg-[#F7F9FC] p-3 text-sm"
                >
                  <span
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${i < 2 ? "bg-[#243A59] text-white" : "border border-[#AAB5C3]"}`}
                  >
                    {i < 2 && <Check className="size-3" />}
                  </span>
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm">
              <span className="text-[#607089]">2 of 3 outcomes complete</span>
              <strong>Friday is in sight</strong>
            </div>
          </div>
        </section>
        <section className="bg-[#111C30] px-5 py-20 text-white sm:px-8">
          <div className="mx-auto max-w-6xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#AAB5C3]">
              A simpler weekly rhythm
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold sm:text-4xl">
              A plan everyone can understand before Monday gets away.
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                {
                  icon: CheckCircle2,
                  title: "Write the outcome",
                  text: "Choose one main thing to ship. Break it into checkable sub-goals and the work that puts it in front of users.",
                },
                {
                  icon: MessageSquareText,
                  title: "Get a clear yes",
                  text: "Your lead approves the plan or sends it back with a comment. Everyone knows what a good Friday looks like.",
                },
                {
                  icon: UsersRound,
                  title: "Follow through",
                  text: "Tick off outcomes during the week. Leads see submissions, progress, and whether the goal shipped.",
                },
              ].map(({ icon: Icon, title, text }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-white/15 bg-white/5 p-6"
                >
                  <Icon className="size-7 text-[#AAB5C3]" />
                  <h3 className="mt-5 text-xl font-semibold">{title}</h3>
                  <p className="mt-3 leading-relaxed text-[#DDE4ED]">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 md:grid-cols-2">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#243A59]">
              <Sparkles className="size-4" /> AI that improves the plan
            </div>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
              Catch the vague task before your lead has to.
            </h2>
            <p className="mt-5 leading-relaxed text-[#243A59]">
              Ask for a review before you submit. WeekCurve points to the exact
              task, explains the problem, and offers a rewrite you can apply or
              edit. Start from rough notes when the week is still a mess.
            </p>
            <p className="mt-4 text-sm text-[#607089]">
              You stay in control. AI drafts and suggestions never publish a
              plan for you.
            </p>
          </div>
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#607089]">
              Plan review example
            </p>
            <p className="mt-4 rounded-lg bg-[#F7F9FC] p-3 text-sm">
              “Implement checkout”
            </p>
            <div className="mt-4 rounded-lg border border-[#DDE4ED] p-4">
              <p className="text-sm font-semibold text-[#243A59]">
                What needs work
              </p>
              <p className="mt-1 text-sm">
                This describes activity, not a result the team can verify.
              </p>
              <p className="mt-4 text-sm font-semibold text-[#243A59]">
                Suggested rewrite
              </p>
              <p className="mt-1 text-sm">
                “Checkout handles expired cards on staging, confirmed by
                end-to-end tests.”
              </p>
            </div>
            <p className="mt-4 text-xs text-[#607089]">
              A task-level suggestion you can apply with one click.
            </p>
          </div>
        </section>
        <section className="bg-[#DDE4ED]/50 px-5 py-20 sm:px-8">
          <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold sm:text-4xl">
                Know where your team stands.
              </h2>
              <p className="mt-4 max-w-xl leading-relaxed text-[#243A59]">
                Pick a week and see who has submitted, which plans need
                approval, how many tasks are done, and whose main goal shipped.
                Last week is one click away.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {["Submitted", "Approved", "Tasks done", "Goal shipped"].map(
                (label, i) => (
                  <div
                    key={label}
                    className="rounded-xl border border-[#AAB5C3]/50 bg-white p-5"
                  >
                    <p className="text-[#607089]">{label}</p>
                    <p className="mt-2 text-2xl font-semibold">
                      {["4 / 5", "3 / 4", "18 / 24", "2 / 3"][i]}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-5 py-20 text-center sm:px-8">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            Make Friday easier to answer for.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[#243A59]">
            Give your team one place to plan, approve, and finish the week.
          </p>
          <a
            className={buttonVariants({
              size: "lg",
              className: "mt-7 cursor-pointer",
            })}
            href={`${appUrl}/signup`}
          >
            Start with WeekCurve <ArrowRight className="size-4" />
          </a>
        </section>
      </main>
      <footer className="border-t px-5 py-6 text-center text-sm text-[#607089]">
        WeekCurve · Plan the week. Ship the goal.
      </footer>
    </div>
  );
}
