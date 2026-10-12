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
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <Sidebar />
        <MobileNav />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24 sm:p-6 lg:p-8">
            <div className="flex items-center justify-between md:justify-end">
              <div className="flex items-center gap-2 md:hidden">
                <Link to="/dashboard" aria-label="WeekCurve internal">
                  <Logo className="h-6" />
                </Link>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Staff
                </span>
              </div>
              <ThemeToggle variant="compact" />
            </div>
            <Outlet />
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
