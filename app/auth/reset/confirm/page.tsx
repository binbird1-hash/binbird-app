"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useSupabase } from "@/components/providers/SupabaseProvider";

function ResetPasswordConfirmContent() {
  const supabase = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<
    "initializing" | "ready" | "submitting" | "success" | "error"
  >("initializing");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = searchParams?.get("access_token");
    const refreshToken = searchParams?.get("refresh_token");
    const type = searchParams?.get("type");

    if (!accessToken || !refreshToken || type !== "recovery") {
      setError(
        "This password reset link is invalid or has expired. Please request a new one.",
      );
      setStatus("error");
      return;
    }

    async function prepareSession() {
      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken!,
        refresh_token: refreshToken!,
      });

      if (sessionError) {
        setError(
          sessionError.message ||
            "We couldn't verify your reset link. Please request a new one.",
        );
        setStatus("error");
        return;
      }

      const userEmail =
        data.session?.user?.email ?? data.user?.email ?? null;

      setEmail(userEmail);
      setStatus("ready");
    }

    void prepareSession();
  }, [searchParams, supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (status !== "ready") return;

    if (password.length < 8) {
      setError("Your new password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match. Please try again.");
      return;
    }

    setStatus("submitting");
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setStatus("ready");
      return;
    }

    await supabase.auth.signOut();
    setStatus("success");

    setTimeout(() => {
      router.push("/auth/login?reset=success");
    }, 2000);
  }

  if (status === "initializing") {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-2xl font-semibold text-white">Checking link…</h2>
        <p className="text-sm text-white/70">
          Please wait while we verify your password reset link.
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="space-y-6 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">Link expired</h2>
          <p className="text-sm text-white/70">
            {error ??
              "This password reset link is no longer valid. Request a new reset email to continue."}
          </p>
        </div>
        <Link
          href="/auth/reset"
          className="inline-flex items-center justify-center rounded-xl bg-binbird-red px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#ff6c6c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red"
        >
          Request new reset link
        </Link>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="space-y-6 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">Password updated</h2>
          <p className="text-sm text-white/70">
            Your password has been reset successfully. We&apos;re taking you back to
            the sign in page.
          </p>
        </div>
        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center rounded-xl bg-binbird-red px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#ff6c6c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red"
        >
          Return to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3 text-center">
        <h2 className="text-2xl font-semibold text-white">Choose a new password</h2>
        <p className="text-sm text-white/70">
          {email ? (
            <>
              Resetting password for <strong className="text-white">{email}</strong>.
            </>
          ) : (
            "Enter a new password to secure your account."
          )}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <label className="block text-left text-sm font-medium text-white/80" htmlFor="password">
        New password
        <input
          id="password"
          type="password"
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          required
        />
      </label>

      <label className="block text-left text-sm font-medium text-white/80" htmlFor="confirmPassword">
        Confirm password
        <input
          id="confirmPassword"
          type="password"
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          minLength={8}
          required
        />
      </label>

      <button
        type="submit"
        disabled={status !== "ready"}
        className="flex w-full items-center justify-center rounded-xl bg-binbird-red px-4 py-3 text-base font-semibold text-white shadow-lg shadow-red-900/40 transition hover:bg-[#ff6c6c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "submitting" ? "Updating…" : "Save new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 text-center">
          <h2 className="text-2xl font-semibold text-white">Checking link…</h2>
          <p className="text-sm text-white/70">
            Please wait while we verify your password reset link.
          </p>
        </div>
      }
    >
      <ResetPasswordConfirmContent />
    </Suspense>
  );
}
