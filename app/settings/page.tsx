"use client";
import { useState, useEffect } from "react";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { isEmailConfirmed } from "@/lib/auth/isEmailConfirmed";

export default function SettingsPage() {
  const [navPref, setNavPref] = useState<"google" | "waze" | "apple">("google");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = useSupabase();

  useEffect(() => {
    const stored = localStorage.getItem("navPref");
    if (stored === "waze" || stored === "apple" || stored === "google") {
      setNavPref(stored);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || !isEmailConfirmed(user)) {
          if (!isCancelled) {
            setError("Please verify your email before managing preferences.");
          }
          setLoading(false);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("user_profile")
          .select("nav_pref")
          .eq("user_id", user.id)
          .single();

        if (profileError) {
          if (profileError.code === "PGRST116") {
            await supabase.from("user_profile").insert({
              user_id: user.id,
              nav_pref: "google",
            });
            if (!isCancelled) {
              setNavPref("google");
              localStorage.setItem("navPref", "google");
            }
          } else if (!isCancelled) {
            console.error("Failed to load navigation preference", profileError);
            setError(profileError.message ?? "Failed to load preference.");
          }
        } else if (!isCancelled && profile?.nav_pref) {
          const pref = profile.nav_pref;
          if (pref === "google" || pref === "waze" || pref === "apple") {
            setNavPref(pref);
            localStorage.setItem("navPref", pref);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          const message = err instanceof Error ? err.message : "Failed to load preference.";
          setError(message);
          console.error("Unexpected error loading preference", err);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [supabase]);

  async function savePreference(pref: "google" | "waze" | "apple") {
    setError(null);
    setNavPref(pref);
    localStorage.setItem("navPref", pref);
    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be signed in to save preferences.");
        return;
      }

      if (!isEmailConfirmed(user)) {
        setError("Please verify your email before saving preferences.");
        return;
      }

      const { error: upsertError } = await supabase
        .from("user_profile")
        .upsert(
          {
            user_id: user.id,
            nav_pref: pref,
          },
          { onConflict: "user_id" }
        );

      if (upsertError) {
        setError(upsertError.message ?? "Failed to save preference.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save preference.";
      setError(message);
      console.error("Unexpected error saving preference", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-black text-white p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      {error && (
        <p className="mb-4 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200" role="alert">
          {error}
        </p>
      )}
      <p className="mb-1 text-sm text-white/60">
        Choose your default navigation app. This preference syncs with your BinBird account.
      </p>
      <p className="mb-3">Preferred Navigation App:</p>
      <div className="flex flex-col gap-3">
        <button
          onClick={() => savePreference("google")}
          className={`px-4 py-2 rounded-lg font-semibold ${
            navPref === "google" ? "bg-[#ff5757]" : "bg-gray-700"
          } ${saving ? "opacity-70" : ""}`}
          disabled={saving}
        >
          {loading && navPref === "google" ? "Loading…" : "Google Maps"}
        </button>
        <button
          onClick={() => savePreference("waze")}
          className={`px-4 py-2 rounded-lg font-semibold ${
            navPref === "waze" ? "bg-[#ff5757]" : "bg-gray-700"
          } ${saving ? "opacity-70" : ""}`}
          disabled={saving}
        >
          Waze
        </button>
        <button
          onClick={() => savePreference("apple")}
          className={`px-4 py-2 rounded-lg font-semibold ${
            navPref === "apple" ? "bg-[#ff5757]" : "bg-gray-700"
          } ${saving ? "opacity-70" : ""}`}
          disabled={saving}
        >
          Apple Maps
        </button>
      </div>
    </div>
  );
}
