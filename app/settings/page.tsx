"use client";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const [navPref, setNavPref] = useState<"google" | "waze" | "apple">("google");

  useEffect(() => {
    const stored = localStorage.getItem("navPref");
    if (stored === "waze" || stored === "apple" || stored === "google") {
      setNavPref(stored);
    }
  }, []);

  function savePreference(pref: "google" | "waze" | "apple") {
    setNavPref(pref);
    localStorage.setItem("navPref", pref);
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-black text-white p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <p className="mb-3">Preferred Navigation App:</p>
      <div className="flex flex-col gap-3">
        <button
          onClick={() => savePreference("google")}
          className={`px-4 py-2 rounded-lg font-semibold ${
            navPref === "google" ? "bg-[#ff5757]" : "bg-gray-700"
          }`}
        >
          Google Maps
        </button>
        <button
          onClick={() => savePreference("waze")}
          className={`px-4 py-2 rounded-lg font-semibold ${
            navPref === "waze" ? "bg-[#ff5757]" : "bg-gray-700"
          }`}
        >
          Waze
        </button>
        <button
          onClick={() => savePreference("apple")}
          className={`px-4 py-2 rounded-lg font-semibold ${
            navPref === "apple" ? "bg-[#ff5757]" : "bg-gray-700"
          }`}
        >
          Apple Maps
        </button>
      </div>
    </div>
  );
}
