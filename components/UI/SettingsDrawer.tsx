"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Flag, LogOut, Navigation2, Palette } from "lucide-react";
import clsx from "clsx";
import { useMapSettings } from "@/components/Context/MapSettingsContext";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { clearPlannedRun, readPlannedRun } from "@/lib/planned-run";
import { readRunSession, writeRunSession } from "@/lib/run-session";

type NavOptionKey = "google" | "waze" | "apple";
type MapStyleKey = "Dark" | "Light" | "Satellite";

type PickerOption<K extends string> = {
  key: K;
  label: string;
};

const navigationOptions: PickerOption<NavOptionKey>[] = [
  { key: "google", label: "Google Maps" },
  { key: "waze", label: "Waze" },
  { key: "apple", label: "Apple Maps" },
];

const mapStyleOptions: PickerOption<MapStyleKey>[] = [
  { key: "Dark", label: "Dark" },
  { key: "Light", label: "Light" },
  { key: "Satellite", label: "Satellite" },
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
  const [draftNavPref, setDraftNavPref] = useState<NavOptionKey | null>(null);
  const [draftMapStylePref, setDraftMapStylePref] = useState<MapStyleKey | null>(
    null
  );
  const bottomPanelRef = useRef<HTMLDivElement | null>(null);

  const navHasPendingChange =
    draftNavPref !== null && draftNavPref !== navPref;
  const mapStyleHasPendingChange =
    draftMapStylePref !== null && draftMapStylePref !== mapStylePref;

  const navButtonIsActive = activePanel === "nav" || navHasPendingChange;
  const mapButtonIsActive =
    activePanel === "style" || mapStyleHasPendingChange;

  const dismissPanel = useCallback(() => {
    setActivePanel(null);
    setDraftNavPref(null);
    setDraftMapStylePref(null);
  }, [setActivePanel, setDraftMapStylePref, setDraftNavPref]);

  const handlePanelToggle = useCallback(
    (panel: "nav" | "style") => {
      if (activePanel === panel) {
        dismissPanel();
        return;
      }

      if (panel === "nav") {
        setDraftNavPref((current) => current ?? navPref);
      } else {
        setDraftMapStylePref((current) => current ?? mapStylePref);
      }

      setActivePanel(panel);
    },
    [activePanel, dismissPanel, mapStylePref, navPref]
  );

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
    const hasStartedPlan = Boolean(plannedRun?.hasStarted);

    setHasActiveRun(hasActiveSession || hasStartedPlan);
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

  useEffect(() => {
    if (!activePanel) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const panel = bottomPanelRef.current;
      if (!panel) return;
      const target = event.target;
      if (target instanceof Node && !panel.contains(target)) {
        dismissPanel();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [activePanel, dismissPanel]);

  // Save preferences to Supabase
  const saveSettings = async () => {
    const nextNavPref = draftNavPref ?? navPref;
    const nextMapStylePref = draftMapStylePref ?? mapStylePref;

    const navChanged = nextNavPref !== navPref;
    const mapStyleChanged = nextMapStylePref !== mapStylePref;

    if (!navChanged && !mapStyleChanged) {
      dismissPanel();
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (navChanged) {
      setNavPref(nextNavPref);
    }

    if (mapStyleChanged) {
      setMapStylePref(nextMapStylePref);
    }

    const { error } = await supabase
      .from("user_profile")
      .upsert(
        {
          user_id: user.id,
          map_style_pref: nextMapStylePref,
          nav_pref: nextNavPref,
        },
        { onConflict: "user_id" }
      );

    if (!error) {
      dismissPanel();
    }
  };

  const handleEndRun = () => {
    setEndRunError(null);

    const existingSession = readRunSession();
    const plannedRun = readPlannedRun();

    const hasStartedPlan = Boolean(plannedRun?.hasStarted);

    if (!existingSession && !hasStartedPlan) {
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
      dismissPanel();
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
    dismissPanel();
    setIsOpen(false);
    router.push("/auth/sign-in");
  };

  return (
    <>
      {/* Header Bar */}
      <div
        className="fixed left-1/2 top-6 z-40 flex w-full max-w-5xl -translate-x-1/2 justify-end px-4"
      >
        <button
          onClick={() => {
            syncActiveRunState();
            dismissPanel();
            setIsOpen(true);
            setEndRunError(null);
            setLogoutError(null);
          }}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-black/60 text-white shadow-xl shadow-black/40 backdrop-blur transition hover:border-binbird-red hover:text-binbird-red"
          aria-label="Open staff settings"
        >
          <span className="sr-only">Open settings</span>
          <div className="flex flex-col items-center justify-center gap-1.5">
            <span className="block h-0.5 w-6 rounded-full bg-current"></span>
            <span className="block h-0.5 w-6 rounded-full bg-current"></span>
            <span className="block h-0.5 w-6 rounded-full bg-current"></span>
          </div>
        </button>
      </div>

      <div className="w-full h-full pt-24">{/* Map placeholder */}</div>

      {/* Full-Screen Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "tween" }}
            className="fixed inset-0 z-50 bg-gradient-to-br from-black via-gray-950 to-red-950 text-white backdrop-blur-sm"
          >
            {/* Close X top-left */}
            <button
              onClick={() => {
                dismissPanel();
                setIsOpen(false);
              }}
              className="absolute left-6 top-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-black/60 text-2xl font-bold text-white shadow-lg shadow-black/40 transition hover:border-binbird-red hover:text-binbird-red"
              aria-label="Close settings"
            >
              &times;
            </button>

            <div className="px-6 pt-24">
              <h2 className="text-3xl font-semibold">Settings</h2>

              {/* Navigation & Map Style Buttons */}
              <div className="mt-6 grid gap-4">
                <button
                  onClick={() => handlePanelToggle("nav")}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.25em] transition",
                    navButtonIsActive
                      ? "border-binbird-red/60 bg-binbird-red/20 text-white"
                      : "text-white/70 hover:border-binbird-red/40 hover:text-white"
                  )}
                >
                  <Navigation2 className="h-4 w-4" />
                  <span>Navigation App</span>
                </button>
                <button
                  onClick={() => handlePanelToggle("style")}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.25em] transition",
                    mapButtonIsActive
                      ? "border-binbird-red/60 bg-binbird-red/20 text-white"
                      : "text-white/70 hover:border-binbird-red/40 hover:text-white"
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
                      className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.25em] text-white/80 transition hover:border-binbird-red hover:text-white"
                    >
                      <Flag className="h-4 w-4" />
                      <span>End Run</span>
                    </button>
                    {endRunError && (
                      <p className="text-sm text-red-400">{endRunError}</p>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.25em] text-white/80 transition hover:border-binbird-red hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Log Out</span>
                </button>
                {logoutError && <p className="text-sm text-red-400">{logoutError}</p>}
              </div>
            </div>

            {/* Sliding Bottom Panel */}
            <AnimatePresence>
              {activePanel && (
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "tween", duration: 0.18 }}
                  className="fixed bottom-0 left-0 z-50 w-full"
                >
                  <motion.div
                    ref={bottomPanelRef}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 16 }}
                    transition={{ type: "tween", duration: 0.18 }}
                    className="flex max-h-[55vh] flex-col gap-5 overflow-hidden border-t border-white/10 bg-black/90 px-6 pb-6 pt-5 shadow-[0_-18px_40px_rgba(0,0,0,0.6)] backdrop-blur"
                  >
                    <div className="flex flex-1 flex-col overflow-hidden">
                      <p className="text-xs uppercase tracking-[0.35em] text-white/60">
                        {activePanel === "nav" ? "Navigation App" : "Map Style"}
                      </p>
                      <div className="mt-5 flex flex-1 flex-col overflow-y-auto">
                        {activePanel === "nav" ? (
                          <div className="grid gap-3 pb-1">
                            {navigationOptions.map((option) => {
                              const isSelected =
                                (draftNavPref ?? navPref) === option.key;
                              return (
                                <button
                                  key={option.key}
                                  type="button"
                                  onClick={() => setDraftNavPref(option.key)}
                                  className={clsx(
                                    "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-medium transition",
                                    isSelected
                                      ? "border-binbird-red/60 bg-binbird-red/20 text-white"
                                      : "border-white/10 bg-white/5 text-white/70 hover:border-binbird-red/40 hover:text-white"
                                  )}
                                  aria-pressed={isSelected}
                                >
                                  <span>{option.label}</span>
                                  {isSelected && (
                                    <Navigation2 className="h-4 w-4 text-binbird-red" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="grid gap-3 pb-1">
                            {mapStyleOptions.map((option) => {
                              const isSelected =
                                (draftMapStylePref ?? mapStylePref) === option.key;
                              return (
                                <button
                                  key={option.key}
                                  type="button"
                                  onClick={() => setDraftMapStylePref(option.key)}
                                  className={clsx(
                                    "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-medium transition",
                                    isSelected
                                      ? "border-binbird-red/60 bg-binbird-red/20 text-white"
                                      : "border-white/10 bg-white/5 text-white/70 hover:border-binbird-red/40 hover:text-white"
                                  )}
                                  aria-pressed={isSelected}
                                >
                                  <span>{option.label}</span>
                                  {isSelected && <Palette className="h-4 w-4 text-binbird-red" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex flex-col gap-3 border-t border-white/10 pt-4">
                      <button
                        onClick={saveSettings}
                        className="flex items-center justify-center rounded-2xl bg-binbird-red px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/40 transition hover:bg-[#ff4747]"
                      >
                        Save settings
                      </button>
                      <button
                        onClick={dismissPanel}
                        className="flex items-center justify-center rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white/70 transition hover:border-white/40 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
