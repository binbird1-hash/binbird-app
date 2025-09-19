"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

type NavOption = "google" | "waze" | "apple";
type MapStyleOption = "Dark" | "Light" | "Satellite";

interface SettingsDrawerProps {
  onNavChange?: (nav: NavOption) => void;
  onMapStyleChange?: (style: MapStyleOption) => void;
}

export default function SettingsDrawer({
  onNavChange,
  onMapStyleChange,
}: SettingsDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [navPref, setNavPref] = useState<NavOption>("google");
  const [mapStyle, setMapStyle] = useState<MapStyleOption>("Dark");

  const [activePanel, setActivePanel] = useState<"nav" | "style" | null>(null);

  useEffect(() => {
    const storedNav = localStorage.getItem("navPref") as NavOption;
    if (storedNav) setNavPref(storedNav);
    const storedMap = (localStorage.getItem("mapStyle") as MapStyleOption) || "Dark";
    setMapStyle(storedMap);
  }, []);

  const saveNav = () => {
    localStorage.setItem("navPref", navPref);
    onNavChange?.(navPref);
    setActivePanel(null);
  };

  const saveStyle = () => {
    localStorage.setItem("mapStyle", mapStyle);
    onMapStyleChange?.(mapStyle);
    setActivePanel(null);
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
    setActivePanel(null); // Ensure no panel opens automatically
  }}
  className="flex flex-col justify-center items-center h-10 w-10 p-2"
>
  <span className="block w-full h-1 bg-white rounded mb-1"></span>
  <span className="block w-full h-1 bg-white rounded mb-1"></span>
  <span className="block w-full h-1 bg-white rounded"></span>
</button>

      </div>

      <div className="w-full h-full pt-14">{/* Google Map goes here */}</div>

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
                  className="w-full text-left font-semibold text-white uppercase text-sm"
                >
                  Navigation App
                </button>
                <button
                  onClick={() => setActivePanel(activePanel === "style" ? null : "style")}
                  className="w-full text-left font-semibold text-white uppercase text-sm"
                >
                  Map Style
                </button>
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
                  className="fixed bottom-0 left-0 w-full max-h-[50%] bg-black border-t border-[#ff5757] p-6 z-50 flex flex-col"
                >
                  {/* Scrollable Options */}
                  <div className="overflow-y-auto flex-1 mb-4">
                    {activePanel === "nav" ? (
                      <ul className="flex flex-col gap-2">
                        {(["google", "waze", "apple"] as NavOption[]).map((opt) => (
                          <li
                            key={opt}
                            onClick={() => setNavPref(opt)}
                            className={`px-4 py-2 rounded-lg w-full text-left font-semibold cursor-pointer ${
                              navPref === opt
                                ? "bg-white text-black"
                                : "bg-black text-white border border-white"
                            }`}
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
                        {(["Dark", "Light", "Satellite"] as MapStyleOption[]).map((style) => (
                          <li
                            key={style}
                            onClick={() => setMapStyle(style)}
                            className={`px-4 py-2 rounded-lg w-full text-left font-semibold cursor-pointer ${
                              mapStyle === style
                                ? "bg-white text-black"
                                : "bg-black text-white border border-white"
                            }`}
                          >
                            {style}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={activePanel === "nav" ? saveNav : saveStyle}
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
