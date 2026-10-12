import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "@/components/AuthGuard";
import { MobileNav, Sidebar } from "@/components/dashboard/sidebar";
import { OrganizationProvider } from "@/contexts/organization-context";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";

// Pathless layout route: every route file under `src/routes/_main/` renders
// inside this chrome and behind the auth guard, without `_main` appearing in
// the URL. Public pages (e.g. /login) live outside it.
export const Route = createFileRoute("/_main")({ component: MainLayout });

function MainLayout() {
  return (
    <AuthGuard>
      <OrganizationProvider>
        <div className="flex h-screen overflow-hidden bg-background text-foreground">
          <Sidebar />
          <MobileNav />
          <div className="flex flex-1 flex-col overflow-hidden">
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/40 px-4 backdrop-blur-xs sm:px-6 lg:px-8">
              <div className="flex items-center gap-3 md:hidden">
                <Link to="/dashboard" aria-label="WeekCurve">
                  <Logo className="h-6" />
                </Link>
              </div>
              <div className="hidden md:block" />
              <div className="flex items-center gap-2">
                <ThemeToggle variant="compact" />
              </div>
            </header>
            <main className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-6xl space-y-6 p-4 pb-32 sm:p-6 lg:p-8">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </OrganizationProvider>
    </AuthGuard>
  );
}
