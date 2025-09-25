"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { GoogleMap, Marker, DirectionsRenderer, useLoadScript } from "@react-google-maps/api";
import SettingsDrawer from "@/components/UI/SettingsDrawer";
import { darkMapStyle, lightMapStyle, satelliteMapStyle } from "@/lib/mapStyle";
import { MapSettingsProvider, useMapSettings } from "@/components/Context/MapSettingsContext";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { normalizeJobs, type Job } from "@/lib/jobs";
import { readPlannedRun } from "@/lib/planned-run";

function RoutePageContent() {
  const supabase = createClientComponentClient();
  const params = useSearchParams();
  const router = useRouter();
  const { mapStylePref, setMapStylePref, navPref, setNavPref } = useMapSettings();

  const [start, setStart] = useState<{ lat: number; lng: number } | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);
  const [currentLocation, setCurrentLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [popupMsg, setPopupMsg] = useState<string | null>(null);
  const [lockNavigation, setLockNavigation] = useState(false);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
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

  // Parse jobs + start
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = readPlannedRun();
      if (stored) {
        setLockNavigation(Boolean(stored.hasStarted));
        setJobs(stored.jobs.map((job) => ({ ...job })));
        setStart({ lat: stored.start.lat, lng: stored.start.lng });
        return;
      }
      setLockNavigation(false);
    }

    const rawJobs = params.get("jobs");
    const rawStart = params.get("start");
    try {
      if (rawJobs) {
        const parsedJobs = JSON.parse(rawJobs);
        if (Array.isArray(parsedJobs)) {
          setJobs(normalizeJobs(parsedJobs));
        }
      }
      if (rawStart) setStart(JSON.parse(rawStart));
    } catch (err) {
      console.error("Parse failed:", err);
    }
  }, [params]);

  useEffect(() => {
    if (!lockNavigation || typeof window === "undefined") return;

    const enforceRouteFocus = () => {
      const latest = readPlannedRun();
      if (latest && latest.hasStarted) {
        window.history.pushState(null, "", window.location.href);
      } else {
        setLockNavigation(false);
      }
    };

    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      enforceRouteFocus();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [lockNavigation]);

  // Pick up nextIdx
  useEffect(() => {
    const rawNextIdx = params.get("nextIdx");
    if (rawNextIdx) {
      const parsed = parseInt(rawNextIdx, 10);
      if (!isNaN(parsed)) setActiveIdx(parsed);
    }
  }, [params]);

  const activeJob = jobs[activeIdx];
  const previousJob = activeIdx > 0 ? jobs[activeIdx - 1] : null;
  const normalizedAddress = activeJob?.address
    ? activeJob.address.trim().toLowerCase()
    : null;
  const isEndStop = normalizedAddress === "end";

  // Update current location
  useEffect(() => {
    if (!activeJob || !navigator.geolocation) return;

    let isCancelled = false;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (isCancelled) return;
        setCurrentLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        console.warn("Unable to read current location:", err);
        if (!isCancelled) setCurrentLocation(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => {
      isCancelled = true;
    };
  }, [activeJob]);

  // Directions request
  useEffect(() => {
    if (!isLoaded || !jobs.length || !activeJob) return;

    if (isEndStop) {
      setDirections(null);
      return;
    }

    let origin: google.maps.LatLngLiteral | null = null;

    if (currentLocation) {
      origin = currentLocation;
      console.log("🚗 Using GPS as origin:", origin);
    } else if (activeIdx > 0 && previousJob) {
      origin = { lat: previousJob.lat, lng: previousJob.lng };
      console.log("📍 GPS unavailable, using previous job as origin:", origin);
    } else if (start) {
      origin = start;
      console.log("📍 GPS unavailable, using run start as origin:", origin);
    }

    if (!origin) {
      setDirections(null);
      return;
    }

    const destination = { lat: activeJob.lat, lng: activeJob.lng };

    const service = new google.maps.DirectionsService();
    let isCancelled = false;

    service.route(
      { origin, destination, travelMode: google.maps.TravelMode.DRIVING },
      (result, status) => {
        if (isCancelled) return;
        if (status === "OK" && result) {
          setDirections(result);
          console.log(`✅ Directions built: ${JSON.stringify(origin)} → ${JSON.stringify(destination)}`);
        } else {
          console.warn("❌ Directions request failed:", status, result);
          setDirections(null);
        }
      }
    );

    return () => {
      isCancelled = true;
    };
  }, [isLoaded, jobs, activeIdx, start, activeJob, currentLocation, previousJob, isEndStop]);

  // Fit map bounds
  useEffect(() => {
    if (!mapRef) return;
    const bounds = new google.maps.LatLngBounds();
    if (directions)
      directions.routes[0].overview_path.forEach((p) => bounds.extend(p));
    else {
      if (currentLocation) bounds.extend(currentLocation);
      if (activeJob) bounds.extend({ lat: activeJob.lat, lng: activeJob.lng });
    }
    if (!bounds.isEmpty())
      mapRef.fitBounds(bounds, { top: 50, right: 50, bottom: 700, left: 50 });
  }, [mapRef, directions, currentLocation, activeJob]);

  // Distance calculation
  function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function handleArrivedAtLocation() {
    if (!navigator.geolocation) {
      setPopupMsg("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = haversine(pos.coords.latitude, pos.coords.longitude, activeJob.lat, activeJob.lng);
        if (dist <= 500000) {
          router.push(
            `/staff/proof?jobs=${encodeURIComponent(JSON.stringify(jobs))}&idx=${activeIdx}&total=${jobs.length}`
          );
        } else {
          setPopupMsg(`You are too far from the job location. (${Math.round(dist)}m away)`);
        }
      },
      (err) => {
        console.error("Geolocation error", err);
        setPopupMsg("Unable to get your current location.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  if (!isLoaded)
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/70 px-6 py-5 text-center text-sm font-medium text-white/80 shadow-2xl shadow-black/40 backdrop-blur">
          Loading maps experience…
        </div>
      </div>
    );
  if (!activeJob)
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/70 px-6 py-5 text-center text-sm font-medium text-white/80 shadow-2xl shadow-black/40 backdrop-blur">
          No jobs found for this run.
        </div>
      </div>
    );

  const navigateUrl =
    navPref === "google"
      ? `https://www.google.com/maps/dir/?api=1&destination=${activeJob.lat},${activeJob.lng}`
      : navPref === "waze"
      ? `https://waze.com/ul?ll=${activeJob.lat},${activeJob.lng}&navigate=yes`
      : `http://maps.apple.com/?daddr=${activeJob.lat},${activeJob.lng}&dirflg=d`;

  const styleMap =
    mapStylePref === "Dark"
      ? darkMapStyle
      : mapStylePref === "Light"
      ? lightMapStyle
      : satelliteMapStyle;

  return (
    <div className="flex min-h-screen w-full flex-col overflow-hidden">
      <div className="relative flex-1">
        <div className="absolute inset-0">
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={currentLocation || { lat: activeJob.lat, lng: activeJob.lng }}
            zoom={13}
            options={{
              styles: styleMap,
              disableDefaultUI: true,
              zoomControl: false,
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
              keyboardShortcuts: false,
            }}
            onLoad={(map) => setMapRef(map)}
          >
            {currentLocation && (
              <Marker position={currentLocation} icon="http://maps.google.com/mapfiles/ms/icons/green-dot.png" />
            )}
            <Marker
              position={{ lat: activeJob.lat, lng: activeJob.lng }}
              icon="http://maps.google.com/mapfiles/ms/icons/ltblue-dot.png"
            />
            {directions && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: true,
                  preserveViewport: true,
                  polylineOptions: {
                    strokeColor: "#ff5757",
                    strokeOpacity: 0.9,
                    strokeWeight: 5,
                  },
                }}
              />
            )}
          </GoogleMap>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black via-black/80 to-transparent" />
      </div>

      <div className="relative z-10 -mt-32 px-4 pb-16">
        <div className="mx-auto w-full max-w-3xl rounded-3xl border border-white/10 bg-black/80 p-6 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/50">Current stop</p>
              <h2 className="mt-1 text-2xl font-semibold text-white">{activeJob.address}</h2>
              <p className="mt-2 text-sm text-white/60">
                {isEndStop
                  ? "Wrap up the run and head to your end location."
                  : `Navigate to the next property and capture proof once you arrive.`}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Job {activeIdx + 1}</p>
              <p className="mt-1 font-medium text-white">of {jobs.length}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/5 bg-white/5 p-4 text-sm text-white/70">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Navigation preference</p>
                <p className="mt-2 text-base font-medium text-white">{navPref === "waze" ? "Waze" : navPref === "apple" ? "Apple Maps" : "Google Maps"}</p>
                <p className="mt-3 text-xs text-white/60">
                  Launch directions in your preferred app with the button below.
                </p>
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/5 p-4 text-sm text-white/70">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Job notes</p>
                <p className="mt-2 text-sm text-white/60">
                  {activeJob.notes?.length ? activeJob.notes : "No special instructions for this stop."}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => window.open(navigateUrl, "_blank")}
                className="w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red"
              >
                Navigate with {navPref === "waze" ? "Waze" : navPref === "apple" ? "Apple Maps" : "Google Maps"}
              </button>

              <button
                onClick={handleArrivedAtLocation}
                className="w-full rounded-2xl bg-binbird-red px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/40 transition hover:bg-[#ff4747] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red"
              >
                Arrived at location
              </button>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">What&apos;s next</p>
                {jobs[activeIdx + 1] ? (
                  <p className="mt-2 text-sm text-white/60">Upcoming: {jobs[activeIdx + 1].address}</p>
                ) : (
                  <p className="mt-2 text-sm text-white/60">You&apos;re on the final stop for today.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {popupMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-black/90 p-6 text-center text-white shadow-2xl shadow-black/40 backdrop-blur">
            <p className="text-base font-medium">
              {popupMsg.includes("(") ? popupMsg.split("(")[0] : popupMsg}
            </p>
            {popupMsg.includes("(") && (
              <p className="mt-2 text-sm text-white/60">({popupMsg.split("(")[1]}</p>
            )}

            <button
              onClick={() => setPopupMsg(null)}
              className="mt-6 w-full rounded-2xl bg-binbird-red px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/40 transition hover:bg-[#ff4747] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RoutePage() {
  return (
    <MapSettingsProvider>
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-black via-gray-950 to-red-950 text-white">
        <SettingsDrawer />
        <RoutePageContent />
      </div>
    </MapSettingsProvider>
  );
}
