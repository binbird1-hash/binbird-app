"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useMapSettings, MapSettingsProvider } from "@/components/Context/MapSettingsContext";
import { GoogleMap, Marker, Polyline, useLoadScript, Autocomplete } from "@react-google-maps/api";
import polyline from "@mapbox/polyline";
import { useRouter } from "next/navigation";
import SettingsDrawer from "@/components/UI/SettingsDrawer";
import { darkMapStyle, lightMapStyle, satelliteMapStyle } from "@/lib/mapStyle";
import { getLocalISODate } from "@/lib/date";

type Job = {
  id: string;
  address: string;
  lat: number;
  lng: number;
  job_type: "put_out" | "bring_in";
  bins?: string | null;
  notes?: string | null;
  client_name: string | null;
  last_completed_on?: string | null;
  photo_path: string | null;
};

const LIBRARIES: ("places")[] = ["places"];

export default function RunPage() {
  return (
    <MapSettingsProvider>
      <div className="relative min-h-screen bg-black text-white">
        <SettingsDrawer />
        <RunPageContent />
      </div>
    </MapSettingsProvider>
  );
}

function RunPageContent() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const { mapStylePref, setMapStylePref, navPref, setNavPref } = useMapSettings();
  const mapRef = useRef<google.maps.Map | null>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [ordered, setOrdered] = useState<Job[]>([]);
  const [routePath, setRoutePath] = useState<{ lat: number; lng: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const [start, setStart] = useState<{ lat: number; lng: number } | null>(null);
  const [end, setEnd] = useState<{ lat: number; lng: number } | null>(null);
  const [sameAsStart, setSameAsStart] = useState(false);

  const [startAddress, setStartAddress] = useState("");
  const [endAddress, setEndAddress] = useState("");

  const [startAuto, setStartAuto] = useState<google.maps.places.Autocomplete | null>(null);
  const [endAuto, setEndAuto] = useState<google.maps.places.Autocomplete | null>(null);

  const [isPlanned, setIsPlanned] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);
  const [userMoved, setUserMoved] = useState(false);
  const [forceFit, setForceFit] = useState(false); // <-- NEW

  const MELBOURNE_BOUNDS = { north: -37.5, south: -38.3, east: 145.5, west: 144.4 };

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: LIBRARIES,
  });

  // Load user settings from Supabase
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from("user_profile")
        .select("map_style_pref, nav_pref")
        .eq("user_id", user.id)
        .single();

      if (!error && profile) {
        if (profile.map_style_pref) setMapStylePref(profile.map_style_pref);
        if (profile.nav_pref) setNavPref(profile.nav_pref);
      }
    })();
  }, []);

  // Fit bounds helper
  const fitBoundsToMap = useCallback(() => {
    if (!mapRef.current) return;
    const bounds = new google.maps.LatLngBounds();
    if (start) bounds.extend(start);
    if (end) bounds.extend(end);
    (routePath.length ? ordered : jobs).forEach((j) =>
      bounds.extend({ lat: j.lat, lng: j.lng })
    );

    if (!bounds.isEmpty() && (!userMoved || forceFit)) {
      mapRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 700, left: 50 });
      setForceFit(false); // reset after forcing
    }
  }, [start, end, jobs, ordered, routePath, userMoved, forceFit]);

  // Track manual panning
  useEffect(() => {
    if (!mapRef.current) return;
    const listener = mapRef.current.addListener("dragstart", () => setUserMoved(true));
    return () => listener.remove();
  }, []);

  // Reset manual pan when relevant changes occur
  useEffect(() => {
    setUserMoved(false);
    fitBoundsToMap();
  }, [start, end, jobs, ordered, routePath, resetCounter, fitBoundsToMap]);

  // Load today's jobs
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const now = new Date();
        const todayName =
          process.env.NEXT_PUBLIC_DEV_DAY_OVERRIDE ||
          now.toLocaleDateString("en-US", { weekday: "long" });
        const todayDate = getLocalISODate(now);

        const { data, error } = await supabase
          .from("jobs")
          .select("*")
          .eq("assigned_to", user.id)
          .eq("day_of_week", todayName)
          .is("last_completed_on", null);

        if (!error && data) {
          const normalized = (data as any[]).map((j) => ({
            ...j,
            client_name: j?.client_name ?? null,
            last_completed_on:
              j?.last_completed_on !== undefined && j?.last_completed_on !== null
                ? String(j.last_completed_on)
                : null,
            photo_path:
              typeof j?.photo_path === "string" && j.photo_path.trim().length
                ? j.photo_path
                : null,
          }));

          const availableJobs = normalized.filter(
            (job) => job.last_completed_on === null
          );

          setJobs(availableJobs as Job[]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  // Autofill current location
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setStart(coords);
      setForceFit(true); // <-- ensure autofit
      try {
        const resp = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.lat},${coords.lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
        );
        const data = await resp.json();
        if (data.results?.[0]?.formatted_address) setStartAddress(data.results[0].formatted_address);
      } catch (err) {
        console.error("Reverse geocoding failed:", err);
      }
    });
  }, []);

  // Handle "End same as Start"
  useEffect(() => {
    if (sameAsStart && start) {
      setEnd({ lat: start.lat, lng: start.lng });
      setEndAddress(startAddress);
      setForceFit(true); // <-- ensure autofit
    } else if (!sameAsStart) {
      setEnd(null);
      setEndAddress("");
      setForceFit(true); // <-- ensure autofit
    }
  }, [sameAsStart, start, startAddress]);

  // Autocomplete callbacks
  const onStartChanged = () => {
    if (!startAuto) return;
    const place = startAuto.getPlace();
    const loc = place.geometry?.location;
    if (loc) {
      setStart({ lat: loc.lat(), lng: loc.lng() });
      setForceFit(true); // <-- ensure autofit
    }
    if (place.formatted_address) {
      setStartAddress(place.formatted_address);
      if (sameAsStart && loc) {
        setEnd({ lat: loc.lat(), lng: loc.lng() });
        setEndAddress(place.formatted_address);
        setForceFit(true); // <-- ensure autofit
      }
    }
  };

  const onEndChanged = () => {
    if (!endAuto) return;
    const place = endAuto.getPlace();
    const loc = place.geometry?.location;
    if (loc) {
      setEnd({ lat: loc.lat(), lng: loc.lng() });
      setForceFit(true); // <-- ensure autofit
    }
    if (place.formatted_address) setEndAddress(place.formatted_address);
  };

  // Build route
  const buildRoute = async () => {
    if (!start || !end || jobs.length === 0) return alert("Need start, end, and jobs");
    setRoutePath([]);
    setOrdered([]);
    setIsPlanned(false);
    setUserMoved(false);
    setForceFit(true); // <-- ensure autofit
    fitBoundsToMap();

    const waypoints = jobs.map((j) => ({ lat: j.lat, lng: j.lng }));
    const resp = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start, end, waypoints }),
    });
    const opt = await resp.json();
    if (!resp.ok || !opt?.polyline) return alert("Could not build route.");

    setRoutePath(polyline.decode(opt.polyline).map((c) => ({ lat: c[0], lng: c[1] })));
    setOrdered((opt.order || []).map((i: number) => jobs[i]));
    setIsPlanned(true);
    setForceFit(true); // <-- ensure autofit
  };

  if (loading) return <div className="p-6 text-white bg-black">Loading jobs…</div>;
  if (!isLoaded) return <div className="p-6 text-white bg-black">Loading map…</div>;

  const styleMap = mapStylePref === "Dark" ? darkMapStyle : mapStylePref === "Light" ? lightMapStyle : satelliteMapStyle;

  return (
    <div className="flex flex-col min-h-screen max-w-xl mx-auto bg-black text-white">
      <div className="relative h-[150vh]">
        <GoogleMap
          key={resetCounter}
          mapContainerStyle={{ width: "100%", height: "100%" }}
          onLoad={(map) => { mapRef.current = map; fitBoundsToMap(); }}
          options={{ styles: styleMap, disableDefaultUI: true, zoomControl: false }}
        >
          {start && <Marker position={start} icon="http://maps.google.com/mapfiles/ms/icons/green-dot.png" />}
          {!routePath.length
            ? jobs.map((j) => <Marker key={j.id} position={{ lat: j.lat, lng: j.lng }} icon="http://maps.google.com/mapfiles/ms/icons/ltblue-dot.png" />)
            : ordered.map((j) => <Marker key={j.id} position={{ lat: j.lat, lng: j.lng }} icon="http://maps.google.com/mapfiles/ms/icons/ltblue-dot.png" />)}
          {end && <Marker position={end} icon="http://maps.google.com/mapfiles/ms/icons/red-dot.png" />}
          {routePath.length > 0 && <Polyline path={routePath} options={{ strokeColor: "#ff5757", strokeOpacity: 0.9, strokeWeight: 5 }} />}
        </GoogleMap>

        {/* Overlay controls */}
        <div className="fixed inset-x-0 bottom-0 z-10">
          <div className="bg-black w-full flex flex-col gap-3 p-6 relative">
            <div className="absolute top-0 left-0 w-screen bg-[#ff5757]" style={{ height: "2px" }}></div>
            <h1 className="text-xl font-bold text-white relative z-10">Plan Run</h1>

            <Autocomplete
              onLoad={setStartAuto}
              onPlaceChanged={onStartChanged}
              options={{ bounds: MELBOURNE_BOUNDS, strictBounds: true, fields: ["geometry", "formatted_address"] }}
            >
              <input
                type="text"
                value={startAddress}
                onChange={(e) => setStartAddress(e.target.value)}
                placeholder="Start Location"
                className="w-full px-3 py-2 rounded-lg text-black"
                disabled={isPlanned}
              />
            </Autocomplete>

            <Autocomplete
              onLoad={setEndAuto}
              onPlaceChanged={onEndChanged}
              options={{ bounds: MELBOURNE_BOUNDS, strictBounds: true, fields: ["geometry", "formatted_address"] }}
            >
              <input
                type="text"
                value={endAddress}
                onChange={(e) => setEndAddress(e.target.value)}
                placeholder="End Location"
                className="w-full px-3 py-2 rounded-lg text-black"
                disabled={sameAsStart || isPlanned}
              />
            </Autocomplete>

            <div className="flex items-center justify-between text-sm text-gray-300 mt-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sameAsStart}
                  onChange={(e) => setSameAsStart(e.target.checked)}
                  disabled={isPlanned}
                />
                End same as Start
              </label>

              {isPlanned && (
                <button
                  onClick={() => {
                    setRoutePath([]);
                    setOrdered([]);
                    setSameAsStart(false);
                    setEnd(null);
                    setEndAddress("");
                    setIsPlanned(false);
                    setResetCounter((c) => c + 1);
                    setUserMoved(false);
                    setForceFit(true); // <-- ensure autofit after reset
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition((pos) =>
                        setStart({ lat: pos.coords.latitude, lng: pos.coords.longitude })
                      );
                    }
                  }}
                  className="text-white text-sm font-semibold rounded-lg hover:bg-gray-700 transition"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="mt-4">
              <button
                className={`w-full px-4 py-2 rounded-lg font-semibold transition ${
                  isPlanned ? "bg-green-600 hover:bg-green-700" : "bg-[#ff5757] hover:opacity-90"
                }`}
                onClick={() => {
                  if (isPlanned) {
                    router.push(
                      `/staff/route?jobs=${encodeURIComponent(JSON.stringify(ordered))}&start=${encodeURIComponent(
                        JSON.stringify(start)
                      )}&end=${encodeURIComponent(JSON.stringify(end))}`
                    );
                  } else {
                    buildRoute();
                  }
                }}
              >
                {isPlanned ? "Start Route" : "Plan Route"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
