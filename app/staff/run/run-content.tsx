"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useMapSettings, MapSettingsProvider } from "@/components/Context/MapSettingsContext";
import { GoogleMap, Marker, Polyline, useLoadScript, Autocomplete } from "@react-google-maps/api";
import polyline from "@mapbox/polyline";
import { useRouter } from "next/navigation";
import SettingsDrawer from "@/components/UI/SettingsDrawer";
import { darkMapStyle, lightMapStyle, satelliteMapStyle } from "@/lib/mapStyle";
import { normalizeJobs, type Job } from "@/lib/jobs";
import type { JobRecord } from "@/lib/database.types";

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
  const { mapStylePref } = useMapSettings();
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
  const [forceFit, setForceFit] = useState(false);

  const MELBOURNE_BOUNDS = { north: -37.5, south: -38.3, east: 145.5, west: 144.4 };

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: LIBRARIES,
  });

  // ✅ Load today's jobs
  useEffect(() => {
    (async () => {
      console.log("=== FETCH JOBS START ===");

      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        console.log("Supabase user:", user, "Error:", userErr);

        if (!user) {
          console.warn("No logged-in user, aborting job fetch");
          return;
        }

        // Profile lookup
        const { data: profile, error: profileError } = await supabase
          .from("user_profile")
          .select("*")
          .eq("email", user.email)
          .single();

        console.log("Profile lookup result:", profile, "Error:", profileError);

        if (profileError || !profile) {
          console.warn("No profile found for user, aborting job fetch");
          return;
        }

        // Hardcoded weekday mapping
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const now = new Date();
        const todayName = process.env.NEXT_PUBLIC_DEV_DAY_OVERRIDE || days[now.getDay()];

        console.log("Date debug:", {
          nowISO: now.toISOString(),
          todayIndex: now.getDay(),
          todayName,
        });

        // Jobs query
        const { data, error } = await supabase
          .from("jobs")
          .select("*")
          .eq("assigned_to", profile.user_id)
          .ilike("day_of_week", todayName)
          .is("last_completed_on", null);

        console.log("Jobs raw result:", data, "Error:", error);
        console.log("Filter values → user_id:", user?.id, "todayName:", todayName);


        if (!error && data) {
          const normalized = normalizeJobs<JobRecord>(data);
          console.log("Normalized jobs:", normalized);

          const availableJobs = normalized.filter(
            (job) => job.last_completed_on === null
          );

          console.log("Available jobs after filter:", availableJobs);
          setJobs(availableJobs);
        } else {
          console.warn("No jobs found or error occurred");
        }
      } catch (err) {
        console.error("Unexpected error in job fetch:", err);
      } finally {
        console.log("=== FETCH JOBS END ===");
        setLoading(false);
      }
    })();
  }, [supabase]);

  // Fit bounds helper
  const fitBoundsToMap = useCallback(() => {
    if (!mapRef.current) return;
    const bounds = new google.maps.LatLngBounds();
    if (start) bounds.extend(start);
    if (end) bounds.extend(end);
    (routePath.length ? ordered : jobs).forEach((j) => {
      console.log("Extending bounds with job:", j.address, j.lat, j.lng);
      bounds.extend({ lat: j.lat, lng: j.lng });
    });

    if (!bounds.isEmpty() && (!userMoved || forceFit)) {
      console.log("Fitting map bounds");
      mapRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 700, left: 50 });
      setForceFit(false);
    }
  }, [start, end, jobs, ordered, routePath, userMoved, forceFit]);

  // Track manual panning
  useEffect(() => {
    if (!mapRef.current) return;
    const listener = mapRef.current.addListener("dragstart", () => {
      console.log("User started dragging map");
      setUserMoved(true);
    });
    return () => listener.remove();
  }, []);

  // Reset manual pan when relevant changes occur
  useEffect(() => {
    console.log("Resetting map pan, fitting bounds again");
    setUserMoved(false);
    fitBoundsToMap();
  }, [start, end, jobs, ordered, routePath, resetCounter, fitBoundsToMap]);

  // Autofill current location
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      console.log("Got browser geolocation:", coords);
      setStart(coords);
      setForceFit(true);
      try {
        const resp = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.lat},${coords.lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
        );
        const data = await resp.json();
        console.log("Reverse geocode result:", data);
        if (data.results?.[0]?.formatted_address) setStartAddress(data.results[0].formatted_address);
      } catch (err) {
        console.error("Reverse geocoding failed:", err);
      }
    });
  }, []);

  // Handle "End same as Start"
  useEffect(() => {
    if (sameAsStart && start) {
      console.log("Setting end = start");
      setEnd({ lat: start.lat, lng: start.lng });
      setEndAddress(startAddress);
      setForceFit(true);
    } else if (!sameAsStart) {
      console.log("Clearing end point");
      setEnd(null);
      setEndAddress("");
      setForceFit(true);
    }
  }, [sameAsStart, start, startAddress]);

  // Autocomplete callbacks
  const onStartChanged = () => {
    if (!startAuto) return;
    const place = startAuto.getPlace();
    console.log("Start autocomplete place:", place);
    const loc = place.geometry?.location;
    if (loc) {
      setStart({ lat: loc.lat(), lng: loc.lng() });
      setForceFit(true);
    }
    if (place.formatted_address) {
      setStartAddress(place.formatted_address);
      if (sameAsStart && loc) {
        setEnd({ lat: loc.lat(), lng: loc.lng() });
        setEndAddress(place.formatted_address);
        setForceFit(true);
      }
    }
  };

  const onEndChanged = () => {
    if (!endAuto) return;
    const place = endAuto.getPlace();
    console.log("End autocomplete place:", place);
    const loc = place.geometry?.location;
    if (loc) {
      setEnd({ lat: loc.lat(), lng: loc.lng() });
      setForceFit(true);
    }
    if (place.formatted_address) setEndAddress(place.formatted_address);
  };

  // Build route
  const buildRoute = async () => {
    console.log("Building route with:", { start, end, jobs });
    if (!start || !end || jobs.length === 0) return alert("Need start, end, and jobs");
    setRoutePath([]);
    setOrdered([]);
    setIsPlanned(false);
    setUserMoved(false);
    setForceFit(true);
    fitBoundsToMap();

    const waypoints = jobs.map((j) => ({ lat: j.lat, lng: j.lng }));
    const resp = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start, end, waypoints }),
    });
    const opt = await resp.json();
    console.log("Optimize API response:", opt);
    if (!resp.ok || !opt?.polyline) return alert("Could not build route.");

    setRoutePath(polyline.decode(opt.polyline).map((c) => ({ lat: c[0], lng: c[1] })));
    setOrdered((opt.order || []).map((i: number) => jobs[i]));
    setIsPlanned(true);
    setForceFit(true);
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
          onLoad={(map) => { 
            console.log("Google Map loaded"); 
            mapRef.current = map; 
            fitBoundsToMap(); 
          }}
          options={{ styles: styleMap, disableDefaultUI: true, zoomControl: false }}
        >
          {start && <Marker position={start} icon="http://maps.google.com/mapfiles/ms/icons/green-dot.png" />}
          {!routePath.length
            ? jobs.map((j) => {
                console.log("Rendering job marker:", j.address, j.lat, j.lng);
                return <Marker key={j.id} position={{ lat: j.lat, lng: j.lng }} icon="http://maps.google.com/mapfiles/ms/icons/ltblue-dot.png" />;
              })
            : ordered.map((j) => {
                console.log("Rendering ordered marker:", j.address, j.lat, j.lng);
                return <Marker key={j.id} position={{ lat: j.lat, lng: j.lng }} icon="http://maps.google.com/mapfiles/ms/icons/ltblue-dot.png" />;
              })}
          {end && <Marker position={end} icon="http://maps.google.com/mapfiles/ms/icons/red-dot.png" />}
          {routePath.length > 0 && <Polyline path={routePath} options={{ strokeColor: "#ff5757", strokeOpacity: 0.9, strokeWeight: 5 }} />}
        </GoogleMap>

        {/* Overlay controls */}
        <div className="fixed inset-x-0 bottom-0 z-10">
          <div className="bg-black w-full flex flex-col gap-3 p-6 relative">
            <div className="absolute top-0 left-0 w-screen bg-[#ff5757]" style={{ height: "2px" }}></div>
            <h1 className="text-xl font-bold text-white relative z-10">Plan Run</h1>

            <Autocomplete onLoad={setStartAuto} onPlaceChanged={onStartChanged}>
              <input
                type="text"
                value={startAddress}
                onChange={(e) => setStartAddress(e.target.value)}
                placeholder="Start Location"
                className="w-full px-3 py-2 rounded-lg text-black"
                disabled={isPlanned}
              />
            </Autocomplete>

            <Autocomplete onLoad={setEndAuto} onPlaceChanged={onEndChanged}>
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
                    console.log("Resetting route");
                    setRoutePath([]);
                    setOrdered([]);
                    setSameAsStart(false);
                    setEnd(null);
                    setEndAddress("");
                    setIsPlanned(false);
                    setResetCounter((c) => c + 1);
                    setUserMoved(false);
                    setForceFit(true);
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
                  console.log("Button clicked, isPlanned:", isPlanned);
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
