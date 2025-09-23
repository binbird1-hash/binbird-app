"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Flag,
  LogOut,
  Navigation2,
  Palette,
  MapPinned,
  Route,
  Apple,
  MoonStar,
  Sun,
  Satellite,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";
import { useMapSettings } from "@/components/Context/MapSettingsContext";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { clearPlannedRun, readPlannedRun } from "@/lib/planned-run";
import { readRunSession, writeRunSession } from "@/lib/run-session";

type NavOptionKey = "google" | "waze" | "apple";
type MapStyleKey = "Dark" | "Light" | "Satellite";

const navigationOptions: Array<{
  key: NavOptionKey;
  label: string;
  Icon: LucideIcon;
  accent: string;
  description: string;
}> = [
  {
    key: "google",
    label: "Google Maps",
    Icon: MapPinned,
    accent: "text-[#4285F4]",
    description: "Works everywhere with traffic and Street View.",
  },
  {
    key: "waze",
    label: "Waze",
    Icon: Route,
    accent: "text-[#05C3DD]",
    description: "Crowd alerts keep you ahead of slow-downs.",
  },
  {
    key: "apple",
    label: "Apple Maps",
    Icon: Apple,
    accent: "text-gray-500",
    description: "Perfect for iPhone crews and CarPlay dashboards.",
  },
];

const mapStyleOptions: Array<{
  key: MapStyleKey;
  label: string;
  Icon: LucideIcon;
  accent: string;
  description: string;
}> = [
  {
    key: "Dark",
    label: "Dark",
    Icon: MoonStar,
    accent: "text-indigo-300",
    description: "Low-glare theme made for night runs.",
  },
  {
    key: "Light",
    label: "Light",
    Icon: Sun,
    accent: "text-amber-400",
    description: "Bright daylight view with crisp roads.",
  },
  {
    key: "Satellite",
    label: "Satellite",
    Icon: Satellite,
    accent: "text-emerald-300",
    description: "Aerial imagery for precise property spots.",
  },
];

export default function SettingsDrawer() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const { mapStylePref, setMapStylePref, navPref, setNavPref } = useMapSettings();

  const [isOpen, setIsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<"nav" | "style" | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [endRunError, setEndRunError] = useState<string | null>(null);
  const [hasActiveRun, setHasActiveRun] = useState(false);

  const syncActiveRunState = useCallback(() => {
    const existingSession = readRunSession();
    let hasActiveSession = false;

    if (existingSession) {
      if (!existingSession.endedAt) {
        hasActiveSession = true;
      } else {
        const endedAtDate = new Date(existingSession.endedAt);
        if (Number.isNaN(endedAtDate.getTime())) {
          hasActiveSession = true;
        }
      }
    }

    const plannedRun = readPlannedRun();

    setHasActiveRun(hasActiveSession || Boolean(plannedRun));
  }, []);

  // Load user preferences from Supabase on mount, create row if it doesn't exist
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from("user_profile")
        .select("map_style_pref, nav_pref")
        .eq("user_id", user.id)
        .single();

      if (error && error.code === "PGRST116") {
        // Row doesn't exist, create default
        await supabase.from("user_profile").insert({
          user_id: user.id,
          map_style_pref: "Dark",
          nav_pref: "google",
        });
        setMapStylePref("Dark");
        setNavPref("google");
      } else if (profile) {
        if (profile.map_style_pref) setMapStylePref(profile.map_style_pref);
        if (profile.nav_pref) setNavPref(profile.nav_pref);
      }
    })();
  }, []);

  useEffect(() => {
    syncActiveRunState();
  }, [syncActiveRunState]);

  // Save preferences to Supabase
  const saveSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("user_profile")
      .upsert(
        { user_id: user.id, map_style_pref: mapStylePref, nav_pref: navPref },
        { onConflict: "user_id" }
      );

    if (!error) {
      setActivePanel(null);
    }
  };

  const handleEndRun = () => {
    setEndRunError(null);

    const existingSession = readRunSession();
    const plannedRun = readPlannedRun();

    if (!existingSession && (!plannedRun || plannedRun.jobs.length === 0)) {
      setEndRunError("No active run to end.");
      return;
    }

    const nowIso = new Date().toISOString();

    const hasValidStart =
      existingSession?.startedAt &&
      !Number.isNaN(new Date(existingSession.startedAt).getTime());

    const planCreatedAt =
      plannedRun?.createdAt && !Number.isNaN(new Date(plannedRun.createdAt).getTime())
        ? plannedRun.createdAt
        : null;

    const safeCompleted = Math.max(0, existingSession?.completedJobs ?? 0);
    const existingTotal = Number.isFinite(existingSession?.totalJobs)
      ? Math.max(0, existingSession!.totalJobs)
      : 0;
    const plannedTotal = plannedRun?.jobs?.length ?? 0;
    const totalJobs = Math.max(existingTotal, plannedTotal, safeCompleted);
    const completedJobs = Math.min(safeCompleted, totalJobs);

    const startedAt = hasValidStart
      ? existingSession!.startedAt
      : planCreatedAt ?? nowIso;

    try {
      writeRunSession({
        startedAt,
        endedAt: nowIso,
        totalJobs,
        completedJobs,
      });
      clearPlannedRun();
      syncActiveRunState();
      setActivePanel(null);
      setIsOpen(false);
      router.push("/staff/run/completed");
    } catch (err) {
      console.error("Unable to end run", err);
      setEndRunError("We couldn't end the run. Please try again.");
    }
  };

  const handleSignOut = async () => {
    setLogoutError(null);
    setEndRunError(null);
    clearPlannedRun();
    syncActiveRunState();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setLogoutError("We couldn't sign you out. Please try again.");
      return;
    }
    setActivePanel(null);
    setIsOpen(false);
    router.push("/auth/sign-in");
  };

  return (
    <>
      {/* Header Bar */}
      <div
        className="fixed top-0 left-0 w-full h-14 bg-black z-50 flex items-center px-4 shadow-md"
        style={{ borderBottom: "2px solid #ff5757" }}
      >
        <button
          onClick={() => {
            syncActiveRunState();
            setIsOpen(true);
            setActivePanel(null);
            setEndRunError(null);
            setLogoutError(null);
          }}
          className="flex flex-col justify-center items-center h-10 w-10 p-2"
        >
          <span className="block w-full h-1 bg-white rounded mb-1"></span>
          <span className="block w-full h-1 bg-white rounded mb-1"></span>
          <span className="block w-full h-1 bg-white rounded"></span>
        </button>
      </div>

      <div className="w-full h-full pt-14">{/* Map goes here */}</div>

      {/* Full-Screen Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "tween" }}
            className="fixed top-0 left-0 w-full h-full bg-black text-white z-50"
          >
            {/* Close X top-left */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 left-4 text-white text-3xl font-bold z-50"
            >
              &times;
            </button>

            <div className="pt-16 px-6">
              <h2 className="text-2xl font-bold mb-6">Settings</h2>

              {/* Navigation & Map Style Buttons */}
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => setActivePanel(activePanel === "nav" ? null : "nav")}
                  className={clsx(
                    "flex w-full items-center gap-3 text-left font-semibold uppercase text-sm transition",
                    "text-white hover:text-[#ff5757]",
                    activePanel === "nav" && "text-[#ff5757]"
                  )}
                >
                  <Navigation2 className="h-4 w-4" />
                  <span>Navigation App</span>
                </button>
                <button
                  onClick={() => setActivePanel(activePanel === "style" ? null : "style")}
                  className={clsx(
                    "flex w-full items-center gap-3 text-left font-semibold uppercase text-sm transition",
                    "text-white hover:text-[#ff5757]",
                    activePanel === "style" && "text-[#ff5757]"
                  )}
                >
                  <Palette className="h-4 w-4" />
                  <span>Map Style</span>
                </button>
                {hasActiveRun && (
                  <>
                    <button
                      type="button"
                      onClick={handleEndRun}
                      className="flex w-full items-center gap-3 text-left font-semibold uppercase text-sm text-white transition hover:text-[#ff5757]"
                    >
                      <Flag className="h-4 w-4" />
                      <span>End Run</span>
                    </button>
                    {endRunError && (
                      <p className="text-sm text-red-500">{endRunError}</p>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 text-left font-semibold uppercase text-sm text-white transition hover:text-[#ff5757]"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Log Out</span>
                </button>
                {logoutError && (
                  <p className="text-sm text-red-500">{logoutError}</p>
                )}
              </div>
            </div>

            {/* Sliding Bottom Panel */}
            <AnimatePresence>
              {activePanel && (
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "tween", duration: 0.3 }}
                  className="fixed bottom-0 left-0 w-full max-h-[50%] bg-black p-6 z-50 flex flex-col"
                  style={{ borderTop: "2px solid #ff5757" }}
                >
                  <div className="overflow-y-auto flex-1 mb-4">
                    {activePanel === "nav" ? (
                      <ul className="flex flex-col gap-3">
                        {navigationOptions.map(({ key, label, Icon, accent, description }) => {
                          const isSelected = navPref === key;
                          return (
                            <li key={key}>
                              <button
                                type="button"
                                onClick={() => setNavPref(key)}
                                className={clsx(
                                  "flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black",
                                  isSelected
                                    ? "border-white bg-white text-black focus:ring-[#ff5757]"
                                    : "border-white/10 bg-white/5 text-white hover:bg-white/10 focus:ring-white/40"
                                )}
                              >
                                <span
                                  className={clsx(
                                    "flex h-12 w-12 items-center justify-center rounded-xl transition",
                                    isSelected ? "bg-black/5" : "bg-white/10"
                                  )}
                                >
                                  <Icon className={clsx("h-6 w-6", accent)} />
                                </span>
                                <div className="flex flex-1 flex-col">
                                  <span className="font-semibold">{label}</span>
                                  <span
                                    className={clsx(
                                      "text-xs",
                                      isSelected ? "text-black/60" : "text-white/70"
                                    )}
                                  >
                                    {description}
                                  </span>
                                </div>
                                {isSelected && (
                                  <span className="rounded-full bg-[#ff5757]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#ff5757]">
                                    Active
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <ul className="flex flex-col gap-3">
                        {mapStyleOptions.map(({ key, label, Icon, accent, description }) => {
                          const isSelected = mapStylePref === key;
                          return (
                            <li key={key}>
                              <button
                                type="button"
                                onClick={() => setMapStylePref(key)}
                                className={clsx(
                                  "flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black",
                                  isSelected
                                    ? "border-white bg-white text-black focus:ring-[#ff5757]"
                                    : "border-white/10 bg-white/5 text-white hover:bg-white/10 focus:ring-white/40"
                                )}
                              >
                                <span
                                  className={clsx(
                                    "flex h-12 w-12 items-center justify-center rounded-xl transition",
                                    isSelected ? "bg-black/5" : "bg-white/10"
                                  )}
                                >
                                  <Icon className={clsx("h-6 w-6", accent)} />
                                </span>
                                <div className="flex flex-1 flex-col">
                                  <span className="font-semibold">{label}</span>
                                  <span
                                    className={clsx(
                                      "text-xs",
                                      isSelected ? "text-black/60" : "text-white/70"
                                    )}
                                  >
                                    {description}
                                  </span>
                                </div>
                                {isSelected && (
                                  <span className="rounded-full bg-[#ff5757]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#ff5757]">
                                    Active
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={saveSettings}
                    className="px-4 py-2 bg-[#ff5757] rounded-lg font-semibold"
                  >
                    Save
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
