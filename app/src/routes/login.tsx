import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Lock, LogIn, Mail, Sparkles } from "lucide-react";
import { auth } from "@/api/endpoints/auth/auth";
import { ApiError } from "@/lib/api-client";
import { Logo } from "@/components/Logo";
import { acceptInvite } from "@/api/endpoints/organizations/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthIllustration } from "@/components/auth/AuthIllustration";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const inviteToken = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("invite")
    : null;

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });

  const loginMutation = useMutation({
    mutationFn: (data: LoginFormData) => auth(data),
    onSuccess: async () => {
      setLoginError("");
      if (inviteToken) {
        try {
          const joined = await acceptInvite(inviteToken);
          localStorage.setItem("weekcurve.organization", joined.id);
        } catch {
          setLoginError(
            "Signed in, but the invitation could not be accepted. Check the email or ask for a new link."
          );
          return;
        }
      }
      queryClient.clear();
      navigate({ to: "/" });
    },
    onError: (error: unknown) => {
      if (!(error instanceof ApiError)) {
        setLoginError(
          "Network error. Please check your connection and try again."
        );
        return;
      }

      if (error.status === 401) {
        setLoginError("Incorrect email or password.");
      } else if (error.status === 422) {
        setLoginError("Please check your credentials and try again.");
      } else {
        setLoginError("Login failed. Please try again.");
      }
    },
  });

  const onSubmit = (data: LoginFormData) => {
    setLoginError("");
    loginMutation.mutate(data);
  };

  const signupHref = inviteToken
    ? `/signup?invite=${encodeURIComponent(inviteToken)}`
    : "/signup";

  return (
    <div className="relative flex min-h-screen w-full flex-col justify-between bg-background text-foreground">
      {/* Top Bar with Brand Logo & Compact Theme Toggle */}
      {/* Top Header with Logo & Compact Theme Toggle */}
      <header className="flex items-center justify-between px-6 py-5 sm:px-8 lg:px-12">
        <Link to="/login" aria-label="WeekCurve">
          <Logo className="h-8" />
        </Link>
        <ThemeToggle variant="compact" />
      </header>

      {/* Main Split-Screen Content */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 items-center px-6 py-6 sm:px-8 lg:px-12">
        <div className="grid w-full items-center gap-12 lg:grid-cols-12 lg:gap-14 xl:gap-20">
          {/* Left Column: Authentication Form */}
          <div className="mx-auto w-full max-w-md lg:col-span-6 lg:mx-0 xl:col-span-5">
            <div className="mb-8">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Welcome back
              </h1>
              <p className="mt-2.5 text-sm text-muted-foreground sm:text-base">
                Sign in to plan your week, align with your team, and ship your goals.
              </p>
            </div>
      {/* Main Centered Content */}
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Form Header */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to plan your week, align with your team, and ship your goals.
            </p>
          </div>

            {inviteToken && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-foreground">
                <Sparkles className="size-4 shrink-0 text-primary" />
                <div>
                  <strong className="font-semibold text-primary">Team invitation detected</strong>
                  <p className="mt-0.5 text-muted-foreground">
                    Signing in will accept your pending invite and link you to the organization.
                  </p>
                </div>
          {/* Invitation Banner */}
          {inviteToken && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-foreground">
              <Sparkles className="size-4 shrink-0 text-primary" />
              <div>
                <strong className="font-semibold text-primary">Team invitation detected</strong>
                <p className="mt-0.5 text-muted-foreground">
                  Signing in will accept your pending invite and link you to the organization.
                </p>
              </div>
            )}
            </div>
          )}

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-foreground">Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="email"
                              placeholder="you@company.com"
                              className="h-11 rounded-lg border-input bg-background pl-10 text-sm transition-colors focus-visible:ring-1 focus-visible:ring-primary"
                              autoComplete="email"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
          {/* Centered Login Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-foreground">Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder="you@company.com"
                            className="h-11 rounded-lg border-input bg-background pl-10 text-sm transition-colors focus-visible:ring-1 focus-visible:ring-primary"
                            autoComplete="email"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-foreground">Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter your password"
                              className="h-11 rounded-lg border-input bg-background pl-10 pr-10 text-sm transition-colors focus-visible:ring-1 focus-visible:ring-primary"
                              autoComplete="current-password"
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword((v) => !v)}
                              disabled={!field.value?.length}
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
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {loginError && (
                    <div
                      role="alert"
                      className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-center text-xs font-medium text-destructive"
                    >
                      {loginError}
                    </div>
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-foreground">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            className="h-11 rounded-lg border-input bg-background pl-10 pr-10 text-sm transition-colors focus-visible:ring-1 focus-visible:ring-primary"
                            autoComplete="current-password"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            disabled={!field.value?.length}
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                  <Button
                    type="submit"
                    className="h-11 w-full rounded-lg text-sm font-medium cursor-pointer shadow-xs"
                    disabled={loginMutation.isPending || !form.formState.isValid}
                {loginError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-center text-xs font-medium text-destructive"
                  >
                    <LogIn className="size-4" />
                    {loginMutation.isPending ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
              </Form>
            </div>
                    {loginError}
                  </div>
                )}

            <p className="mt-8 text-center text-xs text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                to={signupHref}
                className="font-medium text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
              >
                Start planning for free
              </Link>
            </p>
                <Button
                  type="submit"
                  className="h-11 w-full rounded-lg text-sm font-medium cursor-pointer shadow-xs"
                  disabled={loginMutation.isPending || !form.formState.isValid}
                >
                  <LogIn className="size-4" />
                  {loginMutation.isPending ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </Form>
          </div>

          {/* Right Column: Original WeekCurve Illustration */}
          <div className="hidden h-[540px] w-full lg:col-span-6 lg:flex xl:col-span-7 xl:h-[580px]">
            <AuthIllustration />
          </div>
          {/* Footer Link */}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              to={signupHref}
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
            >
              Start planning for free
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
