"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { GoogleMap, Marker, DirectionsRenderer, useLoadScript } from "@react-google-maps/api";
import SettingsDrawer from "@/components/UI/SettingsDrawer";
import { PortalLoadingScreen } from "@/components/UI/PortalLoadingScreen";
import { darkMapStyle, lightMapStyle, satelliteMapStyle } from "@/lib/mapStyle";
import { MapSettingsProvider, useMapSettings } from "@/components/Context/MapSettingsContext";
import { normalizeJobs, type Job } from "@/lib/jobs";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { readPlannedRun, writePlannedRun } from "@/lib/planned-run";

function RoutePageContent() {
  const supabase = useSupabase();
  const params = useSearchParams();
  const router = useRouter();
  const { mapStylePref, setMapStylePref, navPref, setNavPref } = useMapSettings();

  useEffect(() => {
    if (typeof document === "undefined") return;

    const html = document.documentElement;
    const body = document.body;

    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlHeight = html.style.height;
    const previousBodyHeight = body.style.height;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.height = "100%";
    body.style.height = "100%";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      html.style.height = previousHtmlHeight;
      body.style.height = previousBodyHeight;
    };
  }, []);

  const [start, setStart] = useState<{ lat: number; lng: number } | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);
  const [currentLocation, setCurrentLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [popupMsg, setPopupMsg] = useState<string | null>(null);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [lockNavigation, setLockNavigation] = useState(false);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  // Load user settings from Supabase
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

      if (!error && profile) {
        if (profile.map_style_pref) setMapStylePref(profile.map_style_pref);
        if (profile.nav_pref) setNavPref(profile.nav_pref);
      }
    })();
  }, [setMapStylePref, setNavPref, supabase]);

  // Parse jobs + start
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = readPlannedRun();
      if (stored) {
        setLockNavigation(Boolean(stored.hasStarted));
        setJobs(stored.jobs.map((job) => ({ ...job })));
        setStart({ lat: stored.start.lat, lng: stored.start.lng });

        if (!params.has("nextIdx") && stored.jobs.length) {
          const clampedIdx = Math.min(
            Math.max(stored.nextIdx ?? 0, 0),
            Math.max(stored.jobs.length - 1, 0)
          );
          setActiveIdx(clampedIdx);
        }
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

  useEffect(() => {
    if (!jobs.length || typeof window === "undefined") return;

    const stored = readPlannedRun();
    if (!stored) return;

    const clampedIdx = Math.min(Math.max(activeIdx, 0), Math.max(jobs.length - 1, 0));
    const storedIdx = Math.min(
      Math.max(stored.nextIdx ?? 0, 0),
      Math.max(stored.jobs.length - 1, 0)
    );

    if (storedIdx === clampedIdx) return;

    writePlannedRun({
      ...stored,
      jobs: jobs.map((job) => ({ ...job })),
      nextIdx: clampedIdx,
    });
  }, [activeIdx, jobs, jobs.length]);

  const activeJob = jobs[activeIdx];
  const previousJob = activeIdx > 0 ? jobs[activeIdx - 1] : null;
  const normalizedAddress = activeJob?.address
    ? activeJob.address.trim().toLowerCase()
    : null;
  const isEndStop = normalizedAddress === "end";

  // Update current location
  useEffect(() => {
    if (!activeJob) return;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      console.warn("Geolocation API unavailable. Falling back to stored coordinates.");
      setCurrentLocation(null);
      setLocationWarning("Enable location sharing/HTTPS to see live position.");
      return;
    }

    let isCancelled = false;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (isCancelled) return;
        setCurrentLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocationWarning(null);
      },
      (err) => {
        console.warn("Unable to read current location:", err);
        if (isCancelled) return;
        setCurrentLocation(null);
        setLocationWarning("Enable location sharing/HTTPS to see live position.");
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
      mapRef.fitBounds(bounds, { top: 0, right: 50, bottom: 350, left: 50 });
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
    if (!activeJob) {
      setPopupMsg("No active job selected.");
      return;
    }
    if (!navigator.geolocation) {
      setPopupMsg("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const dist = haversine(pos.coords.latitude, pos.coords.longitude, activeJob.lat, activeJob.lng);
        if (dist <= 500000) {
          try {
            const {
              data: { user },
              error: authError,
            } = await supabase.auth.getUser();

            if (authError) {
              console.error("Failed to verify session before marking on-site", authError);
            } else if (user) {
              const { error: statusError } = await supabase
                .from("jobs")
                .update({ status: "on_site" })
                .eq("id", activeJob.id)
                .eq("assigned_to", user.id);

              if (statusError) {
                console.error("Failed to update job status to on_site", statusError);
              }
            }
          } catch (err) {
            console.error("Unexpected error updating job status to on_site", err);
          }
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

  if (!isLoaded) return <PortalLoadingScreen message="Loading map…" />;
  if (!activeJob) return <div className="p-6 text-white bg-black">No jobs found.</div>;

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
  <div className="flex flex-col h-screen w-full bg-black text-white overflow-hidden">
    <div className="flex-grow relative">
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
          <Marker position={{ lat: activeJob.lat, lng: activeJob.lng }} icon="http://maps.google.com/mapfiles/ms/icons/ltblue-dot.png" />
          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                suppressMarkers: true,
                preserveViewport: true,
                polylineOptions: { strokeColor: "#ff5757", strokeOpacity: 0.9, strokeWeight: 5 },
              }}
            />
          )}
        </GoogleMap>

        <div className="fixed inset-x-0 bottom-0 z-10">
          <div className="bg-black w-full flex flex-col gap-3 p-6 relative">
            <div className="absolute top-0 left-0 w-screen bg-[#ff5757]" style={{ height: "2px" }}></div>
            <h2 className="text-lg font-bold relative z-10">{activeJob.address}</h2>
            {locationWarning && (
              <p className="text-sm text-amber-300 bg-amber-950/60 border border-amber-500/40 rounded-lg px-3 py-2 relative z-10">
                {locationWarning}
              </p>
            )}
              <button
                onClick={() => window.open(navigateUrl, "_blank")}
                className="w-full bg-neutral-900 text-white px-4 py-2 rounded-lg font-semibold transition hover:bg-neutral-800 relative z-10"
              >
                Navigate
              </button>
            <button
              onClick={handleArrivedAtLocation}
              className="w-full bg-[#ff5757] text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 relative z-10"
            >
              Arrived At Location
            </button>
          </div>
        </div>
      </div>
      
      {popupMsg && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/70">
          <div className="bg-white text-black p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
            {/* Split into two lines */}
            <p className="mb-2">
              {popupMsg.includes("(") ? popupMsg.split("(")[0] : popupMsg}
            </p>
            {popupMsg.includes("(") && (
              <p className="text-sm text-gray-700">({popupMsg.split("(")[1]}</p>
            )}
      
            <button
              onClick={() => setPopupMsg(null)}
              className="mt-4 w-full bg-[#ff5757] text-white px-4 py-2 rounded-lg font-semibold"
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
      <div className="relative min-h-screen overflow-hidden bg-black text-white">
        <SettingsDrawer />
        <RoutePageContent />
      </div>
    </MapSettingsProvider>
  );
}
