"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type MapStyleOption = "Dark" | "Light" | "Satellite";
type NavOption = "google" | "waze" | "apple";

interface MapSettingsContextType {
  mapStylePref: MapStyleOption;
  navPref: NavOption;
  setMapStylePref: (style: MapStyleOption) => void;
  setNavPref: (nav: NavOption) => void;
}

const MapSettingsContext = createContext<MapSettingsContextType | undefined>(undefined);

export function MapSettingsProvider({ children }: { children: ReactNode }) {
  const [mapStylePref, setMapStylePref] = useState<MapStyleOption>("Dark");
  const [navPref, setNavPref] = useState<NavOption>("google");

  return (
    <MapSettingsContext.Provider value={{ mapStylePref, navPref, setMapStylePref, setNavPref }}>
      {children}
    </MapSettingsContext.Provider>
  );
}

export function useMapSettings() {
  const ctx = useContext(MapSettingsContext);
  if (!ctx) throw new Error("useMapSettings must be used within MapSettingsProvider");
  return ctx;
}
