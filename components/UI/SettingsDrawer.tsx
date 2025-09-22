"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useMapSettings } from "@/components/Context/MapSettingsContext";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function SettingsDrawer() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const { mapStylePref, setMapStylePref, navPref, setNavPref } = useMapSettings();

  const [isOpen, setIsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<"nav" | "style" | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);

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

  const handleSignOut = async () => {
    setLogoutError(null);
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
            setIsOpen(true);
            setActivePanel(null);
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
                  className="w-full text-left font-semibold text-white uppercase text-sm transition hover:text-[#ff5757]"
                >
                  Navigation App
                </button>
                <button
                  onClick={() => setActivePanel(activePanel === "style" ? null : "style")}
                  className="w-full text-left font-semibold text-white uppercase text-sm transition hover:text-[#ff5757]"
                >
                  Map Style
                </button>
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
                      <ul className="flex flex-col gap-2">
                        {(["google", "waze", "apple"] as const).map((opt) => (
                          <li
                            key={opt}
                            onClick={() => setNavPref(opt)}
                            className={`px-4 py-2 rounded-lg w-full text-left font-semibold cursor-pointer ${
                              navPref === opt ? "bg-white text-black" : "bg-black text-white"
                            }`}
                            style={{ border: "1px solid white" }}
                          >
                            {opt === "google"
                              ? "Google Maps"
                              : opt === "waze"
                              ? "Waze"
                              : "Apple Maps"}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {(["Dark", "Light", "Satellite"] as const).map((style) => (
                          <li
                            key={style}
                            onClick={() => setMapStylePref(style)}
                            className={`px-4 py-2 rounded-lg w-full text-left font-semibold cursor-pointer ${
                              mapStylePref === style ? "bg-white text-black" : "bg-black text-white"
                            }`}
                            style={{ border: "1px solid white" }}
                          >
                            {style}
                          </li>
                        ))}
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
