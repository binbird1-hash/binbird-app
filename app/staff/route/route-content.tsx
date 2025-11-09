"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { GoogleMap, Marker, DirectionsRenderer, useLoadScript } from "@react-google-maps/api";
import SettingsDrawer from "@/components/UI/SettingsDrawer";
import { PortalLoadingScreen } from "@/components/UI/PortalLoadingScreen";
import { NoticeModal } from "@/components/UI/NoticeModal";
import { darkMapStyle, lightMapStyle, satelliteMapStyle } from "@/lib/mapStyle";
import { MapSettingsProvider, useMapSettings } from "@/components/Context/MapSettingsContext";
import { normalizeJobs, type Job } from "@/lib/jobs";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { clearPlannedRun, readPlannedRun, writePlannedRun } from "@/lib/planned-run";
import { clearRunSession } from "@/lib/run-session";
import { getOperationalISODate, getJobVisibilityRestrictions } from "@/lib/date";

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
  const [popupNotice, setPopupNotice] = useState<{ title: string; description?: string } | null>(null);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [lockNavigation, setLockNavigation] = useState(false);
  const [hasStoredPlan, setHasStoredPlan] = useState(false);
  const operationalDayRef = useRef(getOperationalISODate(new Date()));
  const rolloverHandledRef = useRef(false);

  const [jobVisibility, setJobVisibility] = useState(() =>
    getJobVisibilityRestrictions()
  );
  const bringInRestricted = jobVisibility.bringIn;
  const putOutRestricted = jobVisibility.putOut;
  const allJobsRestricted = bringInRestricted && putOutRestricted;

  const filterJobsForVisibility = useCallback(
    (jobsList: Job[]) =>
      jobsList.filter((job) => {
        if (job.job_type === "bring_in") {
          return !bringInRestricted;
        }

        if (job.job_type === "put_out") {
          return !putOutRestricted;
        }

        return true;
      }),
    [bringInRestricted, putOutRestricted]
  );

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const enforceFreshOperationalDay = () => {
      const currentDay = getOperationalISODate(new Date());
      if (operationalDayRef.current === currentDay) {
        return;
      }

      operationalDayRef.current = currentDay;
      clearRunSession();
      clearPlannedRun();
      setJobs([]);
      setHasStoredPlan(false);
      setLockNavigation(false);
      setActiveIdx(0);
      setPopupNotice({
        title: "Your previous run has ended. Please start a new run.",
      });

      if (!rolloverHandledRef.current) {
        rolloverHandledRef.current = true;
        router.replace("/staff/run");
      }
    };

    enforceFreshOperationalDay();
    const interval = window.setInterval(enforceFreshOperationalDay, 60_000);

    return () => window.clearInterval(interval);
  }, [router]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const interval = window.setInterval(() => {
      setJobVisibility(getJobVisibilityRestrictions());
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  // Parse jobs + start
  useEffect(() => {
    if (allJobsRestricted) {
      setHasStoredPlan(false);
      setLockNavigation(false);
      setJobs([]);
      setStart(null);
      return;
    }

    if (typeof window !== "undefined") {
      const stored = readPlannedRun();
      if (stored) {
        const filteredJobs = filterJobsForVisibility(stored.jobs);
        setHasStoredPlan(true);
        setLockNavigation(Boolean(stored.hasStarted));
        setJobs(filteredJobs.map((job) => ({ ...job })));
        setStart({ lat: stored.start.lat, lng: stored.start.lng });

        if (filteredJobs.length) {
          const clampedIdx = Math.min(
            Math.max(stored.nextIdx ?? 0, 0),
            Math.max(filteredJobs.length - 1, 0)
          );
          setActiveIdx(clampedIdx);
        }
        return;
      }
      setHasStoredPlan(false);
      setLockNavigation(false);
    }

    const rawJobs = params.get("jobs");
    const rawStart = params.get("start");
    try {
      if (rawJobs) {
        const parsedJobs = JSON.parse(rawJobs);
        if (Array.isArray(parsedJobs)) {
          setJobs(filterJobsForVisibility(normalizeJobs(parsedJobs)));
        }
      }
      if (rawStart) setStart(JSON.parse(rawStart));
    } catch (err) {
      console.error("Parse failed:", err);
    }
  }, [allJobsRestricted, filterJobsForVisibility, params]);

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
    if (hasStoredPlan) return;

    const rawNextIdx = params.get("nextIdx");
    if (rawNextIdx) {
      const parsed = parseInt(rawNextIdx, 10);
      if (!isNaN(parsed)) setActiveIdx(parsed);
    }
  }, [hasStoredPlan, params]);

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
    if (!navigator.geolocation) {
      setPopupNotice({ title: "Geolocation not supported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = haversine(pos.coords.latitude, pos.coords.longitude, activeJob.lat, activeJob.lng);
        if (dist <= 40) {
          router.push(
            `/staff/proof?jobs=${encodeURIComponent(JSON.stringify(jobs))}&idx=${activeIdx}&total=${jobs.length}`
          );
        } else {
          setPopupNotice({
            title: "You are too far from the job location.",
            description: `${Math.round(dist)}m away`,
          });
        }
      },
      (err) => {
        console.error("Geolocation error", err);
        setPopupNotice({ title: "Unable to get your current location." });
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
      
      <NoticeModal
        open={Boolean(popupNotice)}
        title={popupNotice?.title ?? ""}
        description={popupNotice?.description}
        onClose={() => setPopupNotice(null)}
      />

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

