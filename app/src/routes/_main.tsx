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
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl space-y-6 p-4 pb-32 sm:p-6 lg:p-8">
              <div className="flex items-center justify-between md:justify-end">
                <div className="md:hidden">
                  <Link to="/dashboard" aria-label="WeekCurve">
                    <Logo className="h-6" />
                  </Link>
                </div>
                <ThemeToggle variant="compact" />
              </div>
              <Outlet />
            </div>
          </main>
        </div>
      </OrganizationProvider>
    </AuthGuard>
  );
}
