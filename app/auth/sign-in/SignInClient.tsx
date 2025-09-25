"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function SignInClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);

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
      const supabase = createClientComponentClient();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
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

      router.push("/staff/run");
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
      <form onSubmit={handleSignIn} className="flex flex-col gap-4">
        {error && <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/50 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/40"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/50 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/40"
          required
        />
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={stayLoggedIn}
            onChange={(e) => setStayLoggedIn(e.target.checked)}
            className="h-4 w-4 rounded border border-white/30 bg-black/40 text-binbird-red focus:ring-binbird-red/60 focus:ring-offset-0"
          />
          Stay logged in
        </label>
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
            onClick={() => router.push("/auth/sign-up")}
            className="ml-2 font-medium text-binbird-red hover:underline"
          >
            Sign Up
          </button>
        </p>
      </form>
    </div>
  );
}
