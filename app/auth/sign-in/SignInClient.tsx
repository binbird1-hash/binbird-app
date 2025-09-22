// app/auth/sign-in/SignInClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import AuthLayout from "../layout";

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
    const supabase = createClientComponentClient({ isSingleton: false });
    const storage = (supabase.auth as {
      storage?: { cookieOptions?: { maxAge?: number } };
    }).storage;
    if (storage?.cookieOptions) {
      storage.cookieOptions.maxAge = stayLoggedIn
        ? 60 * 60 * 24 * 30 * 1000
        : 60 * 60 * 12 * 1000;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (typeof window !== "undefined") {
      if (stayLoggedIn) {
        window.localStorage.setItem("binbird-stay-logged-in", "true");
      } else {
        window.localStorage.removeItem("binbird-stay-logged-in");
      }
    }
    router.push("/staff/run");
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl sm:text-[26px] font-bold text-center mb-6 text-[#ff5757]">
        Welcome to BinBird!
      </h1>
      <form onSubmit={handleSignIn} className="flex flex-col gap-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#ff5757] text-black"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#ff5757] text-black"
          required
        />
        <label className="flex items-center gap-2 text-sm text-black">
          <input
            type="checkbox"
            checked={stayLoggedIn}
            onChange={(e) => setStayLoggedIn(e.target.checked)}
            className="h-4 w-4 rounded border border-gray-400 text-[#ff5757] focus:ring-[#ff5757]"
          />
          Stay logged in
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-lg bg-[#ff5757] text-white font-semibold hover:opacity-90 transition"
        >
          {loading ? "Signing In…" : "Sign In"}
        </button>
        <p className="mt-4 flex justify-center items-center text-sm !text-black">
          <span>Don’t have an account?</span>
          <button
            type="button"
            onClick={() => router.push("/auth/sign-up")}
            className="ml-2 text-[#ff5757] hover:underline"
          >
            Sign Up
          </button>
        </p>
      </form>
    </AuthLayout>
  );
}
