import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  UserPlus,
} from "lucide-react";
import { signup, auth } from "@/api/endpoints/auth/auth";
import {
  acceptInvite,
  previewInvite,
} from "@/api/endpoints/organizations/organizations";
import { useCurrentUser } from "@/contexts/user-context";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthIllustration } from "@/components/auth/AuthIllustration";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const token = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("invite")
    : null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [organizationName, setOrganizationName] = useState("");

  const invite = useQuery({
    queryKey: ["invite", token],
    queryFn: () => previewInvite(token ?? ""),
    enabled: !!token,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const chosenEmail = token ? (invite.data?.email ?? email) : email;
      await signup({
        first_name: firstName,
        last_name: lastName,
        email: chosenEmail,
        password,
        organization_name: token ? null : organizationName,
        invite_token: token,
      });
      await auth({ email: chosenEmail, password });
    },
    onSuccess: () => {
      queryClient.clear();
      navigate({ to: "/dashboard" });
    },
  });

  const accept = useMutation({
    mutationFn: () => acceptInvite(token ?? ""),
    onSuccess: (org) => {
      localStorage.setItem("weekcurve.organization", org.id);
      queryClient.clear();
      navigate({ to: "/dashboard" });
    },
  });

  const loginHref = token
    ? `/login?invite=${encodeURIComponent(token)}`
    : "/login";

  return (
    <div className="relative flex min-h-screen w-full flex-col justify-between bg-background text-foreground">
      {/* Top Bar with Brand Logo & Compact Theme Toggle */}
      {/* Top Header with Brand Logo & Compact Theme Toggle */}
      <header className="flex items-center justify-between px-6 py-5 sm:px-8 lg:px-12">
        <Link to="/signup" aria-label="WeekCurve">
          <Logo className="h-8" />
        </Link>
        <ThemeToggle variant="compact" />
      </header>

      {/* Main Split-Screen Content */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 items-center px-6 py-6 sm:px-8 lg:px-12">
        <div className="grid w-full items-center gap-12 lg:grid-cols-12 lg:gap-14 xl:gap-20">
          {/* Left Column: Registration Form */}
          <div className="mx-auto w-full max-w-md lg:col-span-6 lg:mx-0 xl:col-span-5">
            <div className="mb-8">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Start planning your week
              </h1>
              <p className="mt-2.5 text-sm text-muted-foreground sm:text-base">
                Plan the week. Ship the goal. Built for ambitious teams.
              </p>
      {/* Main Centered Content */}
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Start planning your week
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Plan the week. Ship the goal. Built for ambitious teams.
            </p>
          </div>

          {/* Invite Status Banners */}
          {token && invite.isLoading && (
            <div className="mb-6 rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
              Checking your team invitation…
            </div>
          )}

            {/* Invite Status Banners */}
            {token && invite.isLoading && (
              <div className="mb-6 rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
                Checking your team invitation…
          {token && invite.isError && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs font-medium text-destructive"
            >
              This invitation is invalid or has expired. Please ask your team lead for a new link.
            </div>
          )}

          {token && invite.data && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-foreground">
              <CheckCircle2 className="size-4 shrink-0 text-primary" />
              <div>
                <strong className="font-semibold text-primary">
                  Join {invite.data.organization_name}
                </strong>
                <p className="mt-0.5 text-muted-foreground">
                  Invited as <span className="capitalize font-medium text-foreground">{invite.data.role}</span> for {invite.data.email}.
                </p>
              </div>
            )}
            </div>
          )}

            {token && invite.isError && (
              <div
                role="alert"
                className="mb-6 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs font-medium text-destructive"
          {/* If user is already logged in with active invite */}
          {token && invite.data && currentUser && (
            <div className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
              <p className="text-xs text-muted-foreground">
                You are already signed in as <strong className="text-foreground">{currentUser.email}</strong>.
              </p>
              <p className="mt-1 text-xs text-foreground">
                Accept this invitation to join {invite.data.organization_name} now.
              </p>
              <Button
                className="mt-4 w-full cursor-pointer"
                disabled={accept.isPending}
                onClick={() => accept.mutate()}
              >
                This invitation is invalid or has expired. Please ask your team lead for a new link.
              </div>
            )}
                {accept.isPending ? "Joining organization…" : "Accept invitation"}
              </Button>
              {accept.isError && (
                <p role="alert" className="mt-3 text-center text-xs text-destructive">
                  This invitation belongs to a different email or is no longer available.
                </p>
              )}
            </div>
          )}

            {token && invite.data && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-foreground">
                <CheckCircle2 className="size-4 shrink-0 text-primary" />
                <div>
                  <strong className="font-semibold text-primary">
                    Join {invite.data.organization_name}
                  </strong>
                  <p className="mt-0.5 text-muted-foreground">
                    Invited as <span className="capitalize font-medium text-foreground">{invite.data.role}</span> for {invite.data.email}.
                  </p>
          {/* Standard Signup / Invite Registration Form */}
          {(!token || invite.data) && (!token || !currentUser) && (
            <form
              className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
              onSubmit={(event) => {
                event.preventDefault();
                mutation.mutate();
              }}
            >
              {/* First and Last Name Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">First name</label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      required
                      maxLength={100}
                      placeholder="Alex"
                      className="h-10 rounded-lg pl-9 text-xs"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Last name</label>
                  <Input
                    required
                    maxLength={100}
                    placeholder="Rivera"
                    className="h-10 rounded-lg text-xs"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* If user is already logged in with active invite */}
            {token && invite.data && currentUser && (
              <div className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
                <p className="text-xs text-muted-foreground">
                  You are already signed in as <strong className="text-foreground">{currentUser.email}</strong>.
                </p>
                <p className="mt-1 text-xs text-foreground">
                  Accept this invitation to join {invite.data.organization_name} now.
                </p>
                <Button
                  className="mt-4 w-full cursor-pointer"
                  disabled={accept.isPending}
                  onClick={() => accept.mutate()}
                >
                  {accept.isPending ? "Joining organization…" : "Accept invitation"}
                </Button>
                {accept.isError && (
                  <p role="alert" className="mt-3 text-center text-xs text-destructive">
                    This invitation belongs to a different email or is no longer available.
              {/* Email Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Email address</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    required
                    type="email"
                    autoComplete="email"
                    placeholder="alex@company.com"
                    className="h-11 rounded-lg pl-10 text-sm"
                    value={token ? (invite.data?.email ?? "") : email}
                    disabled={!!token}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {token && (
                  <p className="text-[11px] text-muted-foreground">
                    Locked to invited email address.
                  </p>
                )}
              </div>
            )}

            {/* Standard Signup / Invite Acceptance Registration Form */}
            {(!token || invite.data) && (!token || !currentUser) && (
              <form
                className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
                onSubmit={(event) => {
                  event.preventDefault();
                  mutation.mutate();
                }}
              >
                {/* First and Last Name Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">First name</label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        required
                        maxLength={100}
                        placeholder="Alex"
                        className="h-10 rounded-lg pl-9 text-xs"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Last name</label>
                    <Input
                      required
                      maxLength={100}
                      placeholder="Rivera"
                      className="h-10 rounded-lg text-xs"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
              {/* Password Field with Show/Hide Toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Password (min 12 chars)</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    required
                    minLength={12}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="At least 12 characters"
                    className="h-11 rounded-lg pl-10 pr-10 text-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={!password.length}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

                {/* Email Field */}
              {/* Organization Name Field (only if creating a new org) */}
              {!token && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Email address</label>
                  <label className="text-xs font-medium text-foreground">Organization name</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Building2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      required
                      type="email"
                      autoComplete="email"
                      placeholder="alex@company.com"
                      minLength={2}
                      placeholder="Acme Corp"
                      className="h-11 rounded-lg pl-10 text-sm"
                      value={token ? (invite.data?.email ?? "") : email}
                      disabled={!!token}
                      onChange={(e) => setEmail(e.target.value)}
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                    />
                  </div>
                  {token && (
                    <p className="text-[11px] text-muted-foreground">
                      Locked to invited email address.
                    </p>
                  )}
                </div>
              )}

                {/* Password Field with Show/Hide Toggle */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Password (min 12 chars)</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      required
                      minLength={12}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="At least 12 characters"
                      className="h-11 rounded-lg pl-10 pr-10 text-sm"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      disabled={!password.length}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
              {mutation.isError && (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-center text-xs font-medium text-destructive"
                >
                  {mutation.error instanceof ApiError && mutation.error.status === 409
                    ? "That email is already registered. Sign in to accept an invitation."
                    : "Could not create your account. Please check the details and try again."}
                </div>
              )}

                {/* Organization Name Field (only if creating a new org) */}
                {!token && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Organization name</label>
                    <div className="relative">
                      <Building2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        required
                        minLength={2}
                        placeholder="Acme Corp"
                        className="h-11 rounded-lg pl-10 text-sm"
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {mutation.isError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-center text-xs font-medium text-destructive"
                  >
                    {mutation.error instanceof ApiError && mutation.error.status === 409
                      ? "That email is already registered. Sign in to accept an invitation."
                      : "Could not create your account. Please check the details and try again."}
                  </div>
                )}

                <Button
                  className="h-11 w-full rounded-lg text-sm font-medium cursor-pointer shadow-xs"
                  type="submit"
                  disabled={mutation.isPending}
                >
                  <UserPlus className="size-4" />
                  {mutation.isPending
                    ? "Creating account…"
                    : token
                      ? "Join organization"
                      : "Create account"}
                </Button>
              </form>
            )}

            <p className="mt-8 text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link
                to={loginHref}
                className="font-medium text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
              <Button
                className="h-11 w-full rounded-lg text-sm font-medium cursor-pointer shadow-xs"
                type="submit"
                disabled={mutation.isPending}
              >
                Sign in
              </Link>
            </p>
          </div>
                <UserPlus className="size-4" />
                {mutation.isPending
                  ? "Creating account…"
                  : token
                    ? "Join organization"
                    : "Create account"}
              </Button>
            </form>
          )}

          {/* Right Column: Original WeekCurve Illustration */}
          <div className="hidden h-[540px] w-full lg:col-span-6 lg:flex xl:col-span-7 xl:h-[620px]">
            <AuthIllustration />
          </div>
          {/* Footer Link */}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link
              to={loginHref}
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center text-xs text-muted-foreground sm:px-8 lg:px-12">
        WeekCurve &copy; {new Date().getFullYear()} &middot; Plan the week. Ship the goal.
      </footer>
    </div>
  );
}
