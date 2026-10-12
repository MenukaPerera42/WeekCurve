import { Outlet, createFileRoute } from "@tanstack/react-router";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "@/components/AuthGuard";
import { MobileNav, Sidebar } from "@/components/dashboard/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";

// Pathless layout route: every route file under `src/routes/_main/` renders
// inside this chrome and behind the auth guard, without `_main` appearing in
// the URL. Public pages (e.g. /login) live outside it.
export const Route = createFileRoute("/_main")({ component: MainLayout });

function MainLayout() {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-muted/30">
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <Sidebar />
        <MobileNav />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/40 px-4 backdrop-blur-xs sm:px-6 lg:px-8">
            <div className="flex items-center gap-2.5 md:hidden">
              <Link to="/dashboard" aria-label="WeekCurve internal">
                <Logo className="h-6" />
              </Link>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Staff
              </span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Platform Administration
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle variant="compact" />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24 sm:p-6 lg:p-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
