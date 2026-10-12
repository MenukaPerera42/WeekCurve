import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  LogOut,
  ListTodo,
  UsersRound,
  Settings,
  ChevronDown,
} from "lucide-react";
import { logout } from "@/api/endpoints/auth/auth";
import { useCurrentUser } from "@/contexts/user-context";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/contexts/organization-context";

// `as const` keeps the hrefs as literal types, so TanStack Router can
// type-check them against the generated route tree.
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/plans", label: "My Plans", icon: ListTodo },
  { href: "/teams", label: "Teams", icon: UsersRound },
  { href: "/settings", label: "Organization", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const { organization, organizations, selectOrganization } = useOrganization();

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
      {/* Brand Header */}
      <div className="flex h-16 items-center px-6">
        <Link to="/dashboard" aria-label="WeekCurve">
          <Logo className="h-7" />
        </Link>
      </div>

      {/* Organization Switcher */}
      <div className="px-4 pb-2">
        <label
          htmlFor="organization-switcher"
          className="mb-1.5 block px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
        >
          Organization
        </label>
        <div className="relative">
          <select
            id="organization-switcher"
            className="w-full appearance-none rounded-lg border border-sidebar-border bg-background/50 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-background focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer pr-8"
            value={organization?.id ?? ""}
            onChange={(event) => selectOrganization(event.target.value)}
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
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

      {/* User Footer Profile & Logout */}
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
  const { organization, organizations, selectOrganization } = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useLocation({ select: (l) => l.pathname });

  const signOut = useMutation({
    mutationFn: () => logout(),
    onSettled: () => {
      queryClient.clear();
      navigate({ to: "/login" });
    },
  });

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm text-card-foreground p-2.5 shadow-lg md:hidden">
      {organizations.length > 1 && (
        <div className="relative mb-2">
          <select
            aria-label="Organization"
            className="w-full appearance-none rounded-lg border border-input bg-background text-foreground px-3 py-1.5 text-xs cursor-pointer pr-7 font-medium"
            value={organization?.id ?? ""}
            onChange={(e) => selectOrganization(e.target.value)}
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
      )}
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
