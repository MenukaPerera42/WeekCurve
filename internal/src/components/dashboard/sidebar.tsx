import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  LogOut,
  Users,
  Building2,
  Sparkles,
} from "lucide-react";
import { logout } from "@/api/endpoints/auth/auth";
import { useCurrentUser } from "@/contexts/user-context";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// `as const` keeps the hrefs as literal types, so TanStack Router can
// type-check them against the generated route tree.
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/organizations", label: "Organizations", icon: Building2 },
  { href: "/ai-usage", label: "AI usage", icon: Sparkles },
] as const;

export function Sidebar() {
  const pathname = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useCurrentUser();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await logout();
    },
    onSettled: () => {
      // Drop every cached query so the next session starts clean, then leave.
      queryClient.clear();
      navigate({ to: "/login" });
    },
  });

  const initials =
    user &&
    `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-16 items-center px-6">
        <Link to="/dashboard" aria-label="WeekCurve internal">
          <Logo className="h-7" />
        </Link>
      </div>
      <p className="px-6 pb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Internal · platform staff
      </p>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              to={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3 space-y-3">
        {user && (
          <div className="flex items-center gap-3 rounded-md px-2 py-1.5 bg-muted/40">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {user.first_name} {user.last_name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground cursor-pointer"
          disabled={logoutMutation.isPending}
          onClick={() => logoutMutation.mutate()}
        >
          <LogOut className="size-4" />
          {logoutMutation.isPending ? "Signing out..." : "Logout"}
        </Button>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signOut = useMutation({
    mutationFn: () => logout(),
    onSettled: () => {
      queryClient.clear();
      navigate({ to: "/login" });
    },
  });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 gap-1 border-t border-border bg-card text-card-foreground p-2 shadow-lg md:hidden">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          to={href}
          className="flex cursor-pointer flex-col items-center rounded-md px-1 py-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Icon className="mb-1 size-4" />
          {label}
        </Link>
      ))}
      <button
        type="button"
        className="flex cursor-pointer flex-col items-center rounded-md px-1 py-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
        disabled={signOut.isPending}
        onClick={() => signOut.mutate()}
      >
        <LogOut className="mb-1 size-4" />
        Sign out
      </button>
    </nav>
  );
}
