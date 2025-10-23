"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import {
  normalizePortalRole,
  resolveHighestPriorityRole,
  type PortalRole,
} from "@/lib/roles";

const STAY_SIGNED_IN_KEY = "binbird-stay-logged-in";

function resolveDestination(role: PortalRole) {
  if (role === "admin") {
    return "/admin";
  }

  if (role === "staff") {
    return "/staff/run";
  }

  if (role === "client") {
    return "/client/dashboard";
  }

  return null;
}

export default function SignInClient() {
  const router = useRouter();
  const supabase = useSupabase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedPreference = window.localStorage.getItem(STAY_SIGNED_IN_KEY);
    if (storedPreference === "true") {
      setStaySignedIn(true);
    }
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      const userId = signInData.user?.id ?? null;
      const metadataRole = normalizePortalRole(
        signInData.user?.user_metadata?.role,
      );

      if (!userId) {
        setError("We couldn't verify your account. Please try again.");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profile")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileError) {
        setError("We couldn't confirm your account role. Please try again.");
        setLoading(false);
        return;
      }

      const profileRole = normalizePortalRole(profile?.role);

      const resolvedRole = resolveHighestPriorityRole(
        metadataRole,
        profileRole,
      );

      if (resolvedRole) {
        if (profileRole !== resolvedRole) {
          await supabase
            .from("user_profile")
            .upsert(
              { user_id: userId, role: resolvedRole },
              { onConflict: "user_id" },
            );
        }

        if (signInData.user && metadataRole !== resolvedRole) {
          const nextMetadata = {
            ...signInData.user.user_metadata,
            role: resolvedRole,
          };

          try {
            await supabase.auth.updateUser({ data: nextMetadata });
          } catch (metadataSyncError) {
            console.error(
              "Failed to update auth metadata role",
              metadataSyncError,
            );
          }
        }
      }
      const destination = resolveDestination(resolvedRole);

      if (typeof window !== "undefined") {
        if (staySignedIn) {
          window.localStorage.setItem(STAY_SIGNED_IN_KEY, "true");
        } else {
          window.localStorage.removeItem(STAY_SIGNED_IN_KEY);
        }
      }

      if (!destination) {
        setError(
          "Your account doesn't have a role yet. Please contact support.",
        );
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      router.push(destination);
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : "Something went wrong. Please try again.";
      setError(message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold text-white">
          Sign in to BinBird
        </h2>
        <p className="text-sm text-white/60">
          Use your credentials to access the staff workspace or the client
          dashboard.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="sr-only" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="Email"
            autoComplete="email"
            className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="sr-only" htmlFor="password">
            Password
          </label>
          <div className="flex items-center rounded-xl border border-white/10 bg-white/10 focus-within:border-binbird-red focus-within:ring-2 focus-within:ring-binbird-red/30">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              autoComplete="current-password"
              className="flex-1 rounded-xl bg-transparent px-4 py-3 text-base text-white placeholder:text-white/40 focus:outline-none"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              className="mr-3 rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
              onClick={() => setShowPassword((previous) => !previous)}
              aria-label={
                showPassword ? "Hide password" : "Toggle password visibility"
              }
            >
              {showPassword ? (
                <EyeSlashIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex items-center gap-3 text-sm text-white/70">
          <input
            type="checkbox"
            checked={staySignedIn}
            onChange={(event) => setStaySignedIn(event.target.checked)}
            className="h-4 w-4 rounded border border-white/30 bg-transparent text-binbird-red focus:ring-binbird-red"
          />
          Stay signed in on this device
        </label>
        <Link
          className="text-sm font-medium text-binbird-red hover:text-binbird-red/80"
          href="/auth/reset"
        >
          Forgot password?
        </Link>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center rounded-xl bg-binbird-red px-4 py-3 text-base font-semibold text-white shadow-lg shadow-red-900/40 transition hover:bg-[#ff6c6c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign In"}
      </button>

      <p className="text-center text-sm text-white/60">
        Need an account?{" "}
        <Link
          href="/auth/sign-up"
          className="font-semibold text-binbird-red hover:text-[#ff6c6c]"
        >
          Create one now
        </Link>
        .
      </p>
    </form>
  );
}
