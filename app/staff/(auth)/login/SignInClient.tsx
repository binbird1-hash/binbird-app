"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { fetchRole, getPortalDestination } from "@/app/auth/utils";

export default function SignInClient() {
  const router = useRouter();
  const supabase = useSupabase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedPreference = window.localStorage.getItem("binbird-stay-logged-in");
    if (storedPreference === "true") {
      setStayLoggedIn(true);
    }
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const trimmedEmail = email.trim();
      const normalizedEmail = trimmedEmail.toLowerCase();

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      const user = signInData.user;

      if (!user) {
        setError("We couldn't sign you in. Please try again.");
        setLoading(false);
        return;
      }

      const role = await fetchRole(supabase, { userId: user.id, email: normalizedEmail });

      if (role !== "staff" && role !== "admin") {
        await supabase.auth.signOut();
        setError("This account doesn't have staff access. Please contact your administrator.");
        setLoading(false);
        return;
      }

      // save preference
      if (typeof window !== "undefined") {
        if (stayLoggedIn) {
          window.localStorage.setItem("binbird-stay-logged-in", "true");
        } else {
          window.localStorage.removeItem("binbird-stay-logged-in");
        }
      }

      const destination = getPortalDestination(role);
      setLoading(false);
      router.push(destination);
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : "An unexpected error occurred. Please try again.";
      setError(message);
      setLoading(false);
    }
  }


  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold text-white">Welcome to BinBird</h2>
        <p className="text-sm text-white/60">Use your staff credentials to jump into today&apos;s work.</p>
      </div>
      <form onSubmit={handleSignIn} className="flex flex-col gap-5">
        {error && <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="sr-only" htmlFor="staff-email">
              Email
            </label>
            <input
              id="staff-email"
              type="email"
              value={email}
              placeholder="Email"
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="sr-only" htmlFor="staff-password">
              Password
            </label>
            <div className="flex items-center rounded-xl border border-white/10 bg-white/10 focus-within:border-binbird-red focus-within:ring-2 focus-within:ring-binbird-red/30">
              <input
                id="staff-password"
                type={showPassword ? "text" : "password"}
                value={password}
                placeholder="Password"
                onChange={(event) => setPassword(event.target.value)}
                className="flex-1 rounded-xl bg-transparent px-4 py-3 text-base text-white placeholder:text-white/40 focus:outline-none"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="mr-3 rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                onClick={() => setShowPassword((previous) => !previous)}
                aria-label={showPassword ? "Hide password" : "Toggle password visibility"}
              >
                {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 text-sm text-white/70 sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={stayLoggedIn}
              onChange={(e) => setStayLoggedIn(e.target.checked)}
              className="h-4 w-4 rounded border border-white/30 bg-black/40 text-binbird-red focus:ring-binbird-red/60 focus:ring-offset-0"
            />
            Stay signed in on this device
          </label>
          <Link href="/auth/reset" className="text-sm font-medium text-binbird-red hover:text-[#ff6c6c]">
            Forgot password?
          </Link>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-binbird-red py-3 font-semibold text-white shadow-lg shadow-binbird-red/30 transition hover:bg-[#ff6c6c] focus:outline-none focus:ring-2 focus:ring-binbird-red/50 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
        <p className="mt-2 flex justify-center text-sm text-white/60">
          <span>Don’t have an account?</span>
          <button
            type="button"
            onClick={() => router.push("/staff/sign-up")}
            className="ml-2 font-medium text-binbird-red hover:underline"
          >
            Sign Up
          </button>
        </p>
      </form>
    </div>
  );
}
