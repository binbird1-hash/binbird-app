"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/providers/SupabaseProvider";

export default function AdminSignOutButton() {
  const supabase = useSupabase();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError(signOutError.message);
        setSigningOut(false);
        return;
      }
      router.push("/auth/login");
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message
          : "Failed to sign out. Please try again.";
      setError(message);
      setSigningOut(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="w-full rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
