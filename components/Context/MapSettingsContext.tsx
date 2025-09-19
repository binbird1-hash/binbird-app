"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type MapStyleOption = "Dark" | "Light" | "Satellite";
type NavOption = "google" | "waze" | "apple";

interface MapSettingsContextType {
  mapStyle: MapStyleOption;
  navPref: NavOption;
  setMapStyle: (style: MapStyleOption) => void;
  setNavPref: (nav: NavOption) => void;
}

const MapSettingsContext = createContext<MapSettingsContextType | undefined>(undefined);

export function MapSettingsProvider({ children }: { children: ReactNode }) {
  const [mapStyle, setMapStyle] = useState<MapStyleOption>("Dark");
  const [navPref, setNavPref] = useState<NavOption>("google");

  return (
    <MapSettingsContext.Provider value={{ mapStyle, navPref, setMapStyle, setNavPref }}>
      {children}
    </MapSettingsContext.Provider>
  );
}

export function useMapSettings() {
  const ctx = useContext(MapSettingsContext);
  if (!ctx) throw new Error("useMapSettings must be used within MapSettingsProvider");
  return ctx;
}
