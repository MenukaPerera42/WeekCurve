import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  LogOut,
  ListTodo,
  UsersRound,
  Settings,
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
  { href: "/plans", label: "My plans", icon: ListTodo },
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
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r bg-background md:flex">
      <div className="flex h-16 items-center px-6">
        <Link to="/dashboard" aria-label="WeekCurve">
          <Logo className="h-7" />
        </Link>
      </div>

      <div className="px-3 pb-3">
        <label
          htmlFor="organization-switcher"
          className="mb-1 block px-2 text-xs text-muted-foreground"
        >
          Organization
        </label>
        <select
          id="organization-switcher"
          className="w-full rounded-md border bg-background px-2 py-2 text-sm cursor-pointer"
          value={organization?.id ?? ""}
          onChange={(event) => selectOrganization(event.target.value)}
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              to={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
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

      <div className="border-t p-3">
        {user && (
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
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
          className="mt-1 w-full justify-start text-muted-foreground hover:text-foreground"
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
  const { organization, organizations, selectOrganization } = useOrganization();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signOut = useMutation({ mutationFn: () => logout(), onSettled: () => { queryClient.clear(); navigate({ to: "/login" }); } });
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-white p-2 shadow-lg md:hidden">
      <select
        aria-label="Organization"
        className="mb-1 w-full rounded-md border bg-white px-2 py-1 text-xs cursor-pointer"
        value={organization?.id ?? ""}
        onChange={(e) => selectOrganization(e.target.value)}
      >
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
      <nav className="grid grid-cols-5 gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            to={href}
            className="flex cursor-pointer flex-col items-center rounded-md px-1 py-1 text-[11px] text-[#243A59] hover:bg-[#F7F9FC]"
          >
            <Icon className="mb-1 size-4" />
            {label}
          </Link>
        ))}
        <button type="button" className="flex cursor-pointer flex-col items-center rounded-md px-1 py-1 text-[11px] text-[#243A59]" disabled={signOut.isPending} onClick={() => signOut.mutate()}><LogOut className="mb-1 size-4" />Sign out</button>
      </nav>
    </div>
  );
}
