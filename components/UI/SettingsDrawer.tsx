"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Flag, LogOut, Navigation2, Palette } from "lucide-react";
import clsx from "clsx";
import { useMapSettings } from "@/components/Context/MapSettingsContext";
import { clearPlannedRun, readPlannedRun } from "@/lib/planned-run";
import { readRunSession, writeRunSession } from "@/lib/run-session";
import { useSupabase } from "@/components/providers/SupabaseProvider";

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
  const supabase = useSupabase();
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
  }, [setMapStylePref, setNavPref, supabase]);

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
    router.push("/auth/login");
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
            dismissPanel();
            setIsOpen(true);
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
              onClick={() => {
                dismissPanel();
                setIsOpen(false);
              }}
              className="absolute top-4 left-4 text-white text-3xl font-bold z-50"
            >
              &times;
            </button>

            <div className="pt-16 px-6">
              <h2 className="text-2xl font-bold mb-6">Settings</h2>

              {/* Navigation & Map Style Buttons */}
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => handlePanelToggle("nav")}
                  className={clsx(
                    "flex w-full items-center gap-3 text-left font-semibold uppercase text-sm transition",
                    navButtonIsActive ? "text-[#ff5757]" : "text-white",
                    "hover:text-[#ff5757]"
                  )}
                >
                  <Navigation2 className="h-4 w-4" />
                  <span>Navigation App</span>
                </button>
                <button
                  onClick={() => handlePanelToggle("style")}
                  className={clsx(
                    "flex w-full items-center gap-3 text-left font-semibold uppercase text-sm transition",
                    mapButtonIsActive ? "text-[#ff5757]" : "text-white",
                    "hover:text-[#ff5757]"
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
                  transition={{ type: "tween", duration: 0.18 }}
                  className="fixed bottom-0 left-0 z-50 w-full"
                >
                  <motion.div
                    ref={bottomPanelRef}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 16 }}
                    transition={{ type: "tween", duration: 0.18 }}
                    className="flex max-h-[55vh] flex-col gap-5 overflow-hidden border-t-2 border-[#ff5757] bg-black/95 px-6 pb-6 pt-5 shadow-[0_-18px_40px_rgba(0,0,0,0.55)] backdrop-blur"
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
                                    "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-base font-semibold uppercase tracking-wide transition",
                                    isSelected
                                      ? "border-white bg-white text-black shadow-sm"
                                      : "border-white/15 text-white/70 hover:border-white/30 hover:text-white"
                                  )}
                                  aria-pressed={isSelected}
                                >
                                  <span>{option.label}</span>
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
                                    "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-base font-semibold uppercase tracking-wide transition",
                                    isSelected
                                      ? "border-white bg-white text-black shadow-sm"
                                      : "border-white/15 text-white/70 hover:border-white/30 hover:text-white"
                                  )}
                                  aria-pressed={isSelected}
                                >
                                  <span>{option.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Save Button */}
                    <button
                      onClick={saveSettings}
                      className="mt-3 rounded-lg bg-[#ff5757] px-4 py-2 font-semibold transition hover:bg-[#ff6b6b]"
                    >
                      Save
                    </button>
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
