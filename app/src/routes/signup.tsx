import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const token = new URLSearchParams(window.location.search).get("invite");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  return (
    <main className="min-h-screen bg-[#F7F9FC] px-5 py-12 text-[#111C30]">
      <div className="mx-auto max-w-md space-y-8">
        <Logo className="h-10" />
        <div>
          <h1 className="text-3xl font-semibold">Start planning your week</h1>
          <p className="mt-2 text-[#243A59]">Plan the week. Ship the goal.</p>
        </div>
        {token && invite.isLoading && <p>Checking invitation…</p>}
        {token && invite.isError && (
          <p className="rounded-lg border border-red-300 p-4 text-red-700">
            This invitation is invalid or expired.
          </p>
        )}
        {token && invite.data && (
          <p className="rounded-lg border p-4">
            Join {invite.data.organization_name} as {invite.data.role} (
            {invite.data.email}).
          </p>
        )}
        {token && invite.data && currentUser && (
          <div className="rounded-xl border bg-white p-5">
            <p className="mb-3 text-sm">
              Signed in already? Accept this invitation with your current
              account.
            </p>
            <Button
              className="cursor-pointer"
              disabled={accept.isPending}
              onClick={() => accept.mutate()}
            >
              {accept.isPending ? "Joining…" : "Accept invitation"}
            </Button>
            {accept.isError && (
              <p className="mt-2 text-sm text-red-700">
                This invitation belongs to a different email or is no longer
                available.
              </p>
            )}
          </div>
        )}
        {(!token || invite.data) && !currentUser && (
          <form
            className="space-y-4 rounded-xl border bg-white p-6 shadow-sm"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                First name
                <Input
                  required
                  maxLength={100}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Last name
                <Input
                  required
                  maxLength={100}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </label>
            </div>
            <label className="block text-sm">
              Email
              <Input
                required
                type="email"
                autoComplete="email"
                value={token ? (invite.data?.email ?? "") : email}
                disabled={!!token}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Password
              <Input
                required
                minLength={12}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {!token && (
              <label className="block text-sm">
                Organization name
                <Input
                  required
                  minLength={2}
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                />
              </label>
            )}
            {mutation.isError && (
              <p className="text-sm text-red-700">
                {mutation.error instanceof ApiError &&
                mutation.error.status === 409
                  ? "That email is already registered. Sign in to accept an invitation."
                  : "Could not create your account. Check the details and try again."}
              </p>
            )}
            <Button
              className="w-full cursor-pointer"
              type="submit"
              disabled={mutation.isPending}
            >
              {mutation.isPending
                ? "Creating account…"
                : token
                  ? "Join organization"
                  : "Create account"}
            </Button>
          </form>
        )}
        <p className="text-sm">
          Already have an account?{" "}
          <a
            className="underline"
            href={
              token ? `/login?invite=${encodeURIComponent(token)}` : "/login"
            }
          >
            Sign in
          </a>
          .
        </p>
      </div>
    </main>
  );
}
