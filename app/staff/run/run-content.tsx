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
import {
  clearPlannedRun,
  readPlannedRun,
  writePlannedRun,
  markPlannedRunStarted,
} from "@/lib/planned-run";
import { readRunSession, writeRunSession } from "@/lib/run-session";

const LIBRARIES: ("places")[] = ["places"];

const VICTORIA_BOUNDS: google.maps.LatLngBoundsLiteral = {
  north: -33.7,
  south: -39.2,
  east: 150.05,
  west: 140.95,
};

const applyVictoriaAutocompleteLimits = (
  autocomplete: google.maps.places.Autocomplete
) => {
  const bounds = new google.maps.LatLngBounds(
    { lat: VICTORIA_BOUNDS.south, lng: VICTORIA_BOUNDS.west },
    { lat: VICTORIA_BOUNDS.north, lng: VICTORIA_BOUNDS.east }
  );

  autocomplete.setBounds(bounds);
  autocomplete.setOptions({
    bounds,
    strictBounds: true,
    componentRestrictions: { country: "au" },
  });
};

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
  const hasRedirectedToRoute = useRef(false);

  const redirectToRoute = useCallback(
    (
      jobsList: Job[],
      startLocation: { lat: number; lng: number },
      endLocation: { lat: number; lng: number }
    ) => {
      const params = new URLSearchParams();
      params.set("jobs", JSON.stringify(jobsList));
      params.set("start", JSON.stringify(startLocation));
      params.set("end", JSON.stringify(endLocation));
      router.replace(`/staff/route?${params.toString()}`);
    },
    [router]
  );

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
  const [plannerLocked, setPlannerLocked] = useState(true);
  const [resetCounter, setResetCounter] = useState(0);
  const [userMoved, setUserMoved] = useState(false);
  const [forceFit, setForceFit] = useState(false);

  const MELBOURNE_BOUNDS = { north: -37.5, south: -38.3, east: 145.5, west: 144.4 };

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: LIBRARIES,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = readPlannedRun();
    if (stored) {
      setPlannerLocked(true);
      setIsPlanned(true);
      setJobs(stored.jobs);
      setStart({ lat: stored.start.lat, lng: stored.start.lng });
      setEnd({ lat: stored.end.lat, lng: stored.end.lng });
      setStartAddress(stored.startAddress ?? "");
      setEndAddress(stored.endAddress ?? "");
      setOrdered(stored.jobs);
      setRoutePath([]);
      if (stored.hasStarted && !hasRedirectedToRoute.current) {
        hasRedirectedToRoute.current = true;
        redirectToRoute(stored.jobs, stored.start, stored.end);
      } else if (!stored.hasStarted) {
        hasRedirectedToRoute.current = false;
      }
      return;
    }

    hasRedirectedToRoute.current = false;
    setPlannerLocked(false);
  }, [redirectToRoute]);

  useEffect(() => {
    if (!startAuto) return;
    applyVictoriaAutocompleteLimits(startAuto);
  }, [startAuto]);

  useEffect(() => {
    if (!endAuto) return;
    applyVictoriaAutocompleteLimits(endAuto);
  }, [endAuto]);

  // ✅ Load today's jobs
  useEffect(() => {
    (async () => {
      console.log("=== FETCH JOBS START ===");

      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        
        // ✅ log raw
        console.log("Supabase user:", user, "Error:", userErr);

        if (!user) {
          console.warn("No logged-in user, aborting job fetch");
          return;
        }

        const assigneeId = user.id;

        if (!assigneeId) {
          console.warn("No assignee ID available, aborting job fetch");
          return;
        }

        // Hardcoded weekday mapping
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const now = new Date();
        const todayName = process.env.NEXT_PUBLIC_DEV_DAY_OVERRIDE || days[now.getDay()];

        // ✅ log all main variables in one place
        console.log("Debug snapshot:", {
          userId: user.id,
          assigneeId,
          email: user.email,
          todayName,
          todayIndex: now.getDay(),
          nowISO: now.toISOString(),
        });

        // Jobs query
        const { data, error } = await supabase
          .from("jobs")
          .select("*")
          .eq("assigned_to", assigneeId)
          .ilike("day_of_week", todayName)
          .is("last_completed_on", null);

        console.log("Jobs raw result:", data, "Error:", error);

        if (!error && data) {
          const normalized = normalizeJobs<JobRecord>(data);

          // ✅ log jobs in detail
          console.log("Normalized jobs:", normalized);
          normalized.forEach((j, i) => {
            console.log(`Job[${i}]`, {
              id: j.id,
              address: j.address,
              assigned_to: j.assigned_to,
              day_of_week: j.day_of_week,
              last_completed_on: j.last_completed_on,
            });
          });

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

      if (jobs.length === 0) {
    // ✅ No jobs → zoom out to Melbourne
    bounds.extend({ lat: MELBOURNE_BOUNDS.north, lng: MELBOURNE_BOUNDS.east });
    bounds.extend({ lat: MELBOURNE_BOUNDS.south, lng: MELBOURNE_BOUNDS.west });
    mapRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 200, left: 50 });
    mapRef.current?.setZoom(9);
    return;
  }
    if (start) bounds.extend(start);
    if (end) bounds.extend(end);
    (routePath.length ? ordered : jobs).forEach((j) => {
      console.log("Extending bounds with job:", j.address, j.lat, j.lng);
      bounds.extend({ lat: j.lat, lng: j.lng });
    });

    if (!bounds.isEmpty() && (!userMoved || forceFit)) {
      console.log("Fitting map bounds");
      mapRef.current.fitBounds(bounds, { top: 0, right: 50, bottom: 350, left: 50 });
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

  const redirectExistingPlan = useCallback(() => {
    const stored = readPlannedRun();
    if (stored) {
      if (!stored.hasStarted) {
        markPlannedRunStarted();
      }
      hasRedirectedToRoute.current = true;
      redirectToRoute(stored.jobs, stored.start, stored.end);
      return true;
    }

    if (start && end && ordered.length) {
      const normalizedStartAddress = startAddress.trim().length
        ? startAddress.trim()
        : null;
      const normalizedEndAddress = endAddress.trim().length
        ? endAddress.trim()
        : null;

      writePlannedRun({
        start,
        end,
        jobs: ordered,
        startAddress: normalizedStartAddress,
        endAddress: normalizedEndAddress,
        createdAt: new Date().toISOString(),
        hasStarted: true,
      });

      hasRedirectedToRoute.current = true;
      redirectToRoute(ordered, start, end);
      return true;
    }

    return false;
  }, [end, endAddress, ordered, redirectToRoute, start, startAddress]);

  const handleStartRun = useCallback(() => {
    console.log("Starting run…");
    const existingSession = readRunSession();
    const nowIso = new Date().toISOString();

    const hasExistingStart =
      existingSession?.startedAt &&
      !Number.isNaN(new Date(existingSession.startedAt).getTime()) &&
      (!existingSession.endedAt ||
        Number.isNaN(new Date(existingSession.endedAt).getTime()));

    const startedAt = hasExistingStart ? existingSession.startedAt : nowIso;

    writeRunSession({
      startedAt,
      endedAt: null,
      totalJobs: jobs.length,
      completedJobs: 0,
    });

    redirectExistingPlan();
  }, [jobs.length, redirectExistingPlan]);

  const handleReset = useCallback(() => {
    console.log("Resetting route");
    clearPlannedRun();
    hasRedirectedToRoute.current = false;
    setRoutePath([]);
    setOrdered([]);
    setSameAsStart(false);
    setEnd(null);
    setEndAddress("");
    setIsPlanned(false);
    setPlannerLocked(false);
    setResetCounter((c) => c + 1);
    setUserMoved(false);
    setForceFit(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) =>
        setStart({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      );
    }
  }, []);

  // Build route
  const buildRoute = async () => {
    console.log("Building route with:", { start, end, jobs });
    if (!start || !end || jobs.length === 0) {
      alert("Need start, end, and jobs");
      return;
    }
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

    const plannedJobs = (opt.order || []).map((i: number) => jobs[i]);
    if (!plannedJobs.length) {
      alert("Could not build route.");
      return;
    }

    setRoutePath(polyline.decode(opt.polyline).map((c) => ({ lat: c[0], lng: c[1] })));
    setOrdered(plannedJobs);
    setIsPlanned(true);
    setForceFit(true);

    const normalizedStartAddress = startAddress.trim().length ? startAddress.trim() : null;
    const normalizedEndAddress = endAddress.trim().length ? endAddress.trim() : null;

    writePlannedRun({
      start,
      end,
      jobs: plannedJobs,
      startAddress: normalizedStartAddress,
      endAddress: normalizedEndAddress,
      createdAt: new Date().toISOString(),
      hasStarted: false,
    });

    setPlannerLocked(true);
    hasRedirectedToRoute.current = false;
  };

  if (loading) return <div className="p-6 text-white bg-black">Loading jobs…</div>;
  if (!isLoaded) return <div className="p-6 text-white bg-black">Loading map…</div>;

  const styleMap = mapStylePref === "Dark" ? darkMapStyle : mapStylePref === "Light" ? lightMapStyle : satelliteMapStyle;

  return (
    <div className="flex flex-col h-screen w-full bg-black text-white overflow-hidden">

      <div className="flex-grow relative">

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
                onChange={(e) => {
                  const value = e.target.value;
                  setStartAddress(value);
                  if (!value.trim()) {
                    setStart(null);
                    setForceFit(true);
                    if (sameAsStart) {
                      setEnd(null);
                      setEndAddress("");
                    }
                  }
                }}
                placeholder="Where you are right now"
                className="w-full px-3 py-2 rounded-lg text-black"
                disabled={isPlanned || plannerLocked}
              />
            </Autocomplete>

            <Autocomplete onLoad={setEndAuto} onPlaceChanged={onEndChanged}>
              <input
                type="text"
                value={endAddress}
                onChange={(e) => setEndAddress(e.target.value)}
                placeholder="Where you want to go after run"
                className="w-full px-3 py-2 rounded-lg text-black"
                disabled={sameAsStart || isPlanned || plannerLocked}
              />
            </Autocomplete>

            <div className="flex items-center justify-between text-sm text-gray-300 mt-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sameAsStart}
                  onChange={(e) => setSameAsStart(e.target.checked)}
                  disabled={isPlanned || plannerLocked}
                />
                Finish at same place I started
              </label>

              {isPlanned && (
                <button
                  onClick={handleReset}
                  className="text-white text-sm font-semibold rounded-lg hover:bg-gray-700 transition"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="mt-4">
              {jobs.length === 0 ? (
                <button
                  className="w-full px-4 py-2 rounded-lg font-semibold bg-[#ff5757] opacity-60 cursor-not-allowed"
                  disabled
                >
                  All Jobs Completed
                </button>
              ) : !isPlanned ? (
                // Plan Run button (grey)
                <button
                  className="w-full px-4 py-2 rounded-lg font-semibold bg-neutral-900 text-white hover:bg-neutral-800 transition"
                  onClick={() => {
                    console.log("Planning run…");
                    buildRoute();
                  }}
                  disabled={plannerLocked}
                >
                  Plan Run
                </button>
              ) : (
                // Start Run button (accent red)
                <button
                  className="w-full px-4 py-2 rounded-lg font-semibold bg-[#ff5757] text-white hover:opacity-90 transition"
                  onClick={handleStartRun}
                >
                  Start Run
                </button>
              )}
            </div>            
          </div>
        </div>
      </div>
    </div>
  );
}
