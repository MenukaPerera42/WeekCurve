import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  LogOut,
  Users,
  Building2,
  Sparkles,
  ShieldCheck,
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
  { href: "/ai-usage", label: "AI Usage", icon: Sparkles },
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
      {/* Brand Header & Staff Console Badge */}
      <div className="flex h-16 items-center justify-between px-6">
        <Link to="/dashboard" aria-label="WeekCurve Internal">
          <Logo className="h-7" />
        </Link>
        <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Console
        </span>
      </div>

      <div className="px-5 pb-2">
        <div className="inline-flex items-center gap-1.5 rounded-md border border-sidebar-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" />
          <span>Platform Staff Access</span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              to={href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer",
                active
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Staff Profile Footer & Logout */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        {user && (
          <div className="flex items-center gap-3 rounded-lg px-2.5 py-2 bg-muted/40 border border-sidebar-border/50">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">
                {user.first_name} {user.last_name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer h-9 px-2.5"
          disabled={logoutMutation.isPending}
          onClick={() => logoutMutation.mutate()}
        >
          <LogOut className="size-3.5 mr-2" />
          {logoutMutation.isPending ? "Signing out…" : "Logout"}
        </Button>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = useLocation({ select: (l) => l.pathname });
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
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm text-card-foreground p-2.5 shadow-lg md:hidden">
      <nav className="grid grid-cols-5 gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              to={href}
              className={cn(
                "flex cursor-pointer flex-col items-center rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="mb-1 size-4" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className="flex cursor-pointer flex-col items-center rounded-lg px-1 py-1.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          disabled={signOut.isPending}
          onClick={() => signOut.mutate()}
        >
          <LogOut className="mb-1 size-4" />
          <span>Sign out</span>
        </button>
      </nav>
    </div>
  );
}
