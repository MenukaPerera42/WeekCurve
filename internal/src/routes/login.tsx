import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Lock, LogIn, Mail, ShieldAlert } from "lucide-react";
import { auth } from "@/api/endpoints/auth/auth";
import { applyApiErrorToForm } from "@/lib/api-error";
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
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

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

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    // Validate a field only after it's blurred once, then re-validate live as
    // the user corrects it — so errors never flash while still typing.
    mode: "onTouched",
  });

  const loginMutation = useMutation({
    mutationFn: (data: LoginFormData) => auth(data),
    onSuccess: () => {
      setLoginError("");
      // Clear cached data so no prior session leaks into the new one.
      queryClient.clear();
      navigate({ to: "/" });
    },
    onError: (error: unknown) => {
      // Field-specific problems (e.g. a malformed email) attach inline; a bad
      // credentials 401 has no field and comes back as the form-level message.
      const formError = applyApiErrorToForm(error, form.setError, {
        fields: ["email", "password"],
        fallback: "Login failed. Please check your credentials.",
      });
      setLoginError(formError ?? "");
    },
  });

  const onSubmit = (data: LoginFormData) => {
    setLoginError("");
    loginMutation.mutate(data);
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col justify-between bg-background text-foreground">
      {/* Top Header with Brand Logo, Console Badge & Compact Theme Toggle */}
      <header className="flex items-center justify-between px-6 py-5 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3">
          <Link to="/login" aria-label="WeekCurve Internal">
            <Logo className="h-8" />
          </Link>
          <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Console
          </span>
        </div>
        <ThemeToggle variant="compact" />
      </header>

      {/* Main Centered Content */}
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Header & Restricted Access Pill */}
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3.5 py-1 text-xs font-medium text-foreground shadow-xs">
              <ShieldAlert className="size-3.5 text-amber-500" />
              <span className="font-mono text-[11px] uppercase tracking-wider">
                Internal &middot; Restricted Access
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Platform Administration
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in with your authorized platform staff credentials.
            </p>
          </div>

          {/* Centered Staff Login Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-foreground">Staff Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder="admin@weekcurve.internal"
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
                            placeholder="Enter staff password"
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
                )}

                <Button
                  type="submit"
                  className="h-11 w-full rounded-lg text-sm font-medium cursor-pointer shadow-xs"
                  disabled={loginMutation.isPending || !form.formState.isValid}
                >
                  <LogIn className="size-4" />
                  {loginMutation.isPending ? "Authenticating…" : "Sign in to console"}
                </Button>
              </form>
            </Form>
          </div>

          {/* Subtitle notice */}
          <p className="mt-8 text-center text-xs text-muted-foreground">
            WeekCurve Platform Administration. Unauthorized access is logged and strictly prohibited.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center text-xs text-muted-foreground sm:px-8 lg:px-12">
        WeekCurve Internal &copy; {new Date().getFullYear()} &middot; Platform Staff Console
      </footer>
    </div>
  );
}
