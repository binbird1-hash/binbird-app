"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useMapSettings, MapSettingsProvider } from "@/components/Context/MapSettingsContext";
import { GoogleMap, Marker, Polyline, useLoadScript, Autocomplete, OverlayViewF } from "@react-google-maps/api";
import polyline from "@mapbox/polyline";
import { useRouter } from "next/navigation";
import SettingsDrawer from "@/components/UI/SettingsDrawer";
import { PortalLoadingScreen } from "@/components/UI/PortalLoadingScreen";
import { NoticeModal } from "@/components/UI/NoticeModal";
import { darkMapStyle, lightMapStyle, satelliteMapStyle } from "@/lib/mapStyle";
import { normalizeJobs, type Job } from "@/lib/jobs";
import type { JobRecord } from "@/lib/database.types";
import { clearPlannedRun, readPlannedRun, writePlannedRun } from "@/lib/planned-run";
import { readRunSession, writeRunSession } from "@/lib/run-session";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { LocationPermissionBanner } from "@/components/UI/LocationPermissionBanner";
import {
  getOperationalDayIndex,
  getOperationalDayName,
  getJobVisibilityRestrictions,
} from "@/lib/date";

const LIBRARIES: ("places")[] = ["places"];

const JOB_MARKER_ICON = "http://maps.google.com/mapfiles/ms/icons/ltblue-dot.png";
const JOB_MARKER_ICON_HEIGHT_PX = 32;
const JOB_MARKER_POPUP_OFFSET_PX = JOB_MARKER_ICON_HEIGHT_PX - 6;
const JOB_TYPE_LABELS: Record<Job["job_type"], string> = {
  put_out: "Put bins out",
  bring_in: "Bring bins in",
};

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
      <div className="relative min-h-screen overflow-hidden bg-black text-white">
        <SettingsDrawer />
        <RunPageContent />
      </div>
    </MapSettingsProvider>
  );
}

function RunPageContent() {
  const supabase = useSupabase();
  const router = useRouter();
  const { mapStylePref } = useMapSettings();
  const mapRef = useRef<google.maps.Map | null>(null);
  const hasRedirectedToRoute = useRef(false);
  const [jobVisibility, setJobVisibility] = useState(() =>
    getJobVisibilityRestrictions()
  );
  const [blackoutNoticeOpen, setBlackoutNoticeOpen] = useState(() =>
    jobVisibility.bringIn
  );
  const bringInRestricted = jobVisibility.bringIn;
  const putOutRestricted = jobVisibility.putOut;
  const allJobsRestricted = bringInRestricted && putOutRestricted;
  const [hiddenJobsCount, setHiddenJobsCount] = useState(0);
  const [plannerNotice, setPlannerNotice] = useState<{
    title: string;
    description?: string;
  } | null>(null);
  const [locationAllowed, setLocationAllowed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const interval = window.setInterval(() => {
      setJobVisibility(getJobVisibilityRestrictions());
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (bringInRestricted) {
      setBlackoutNoticeOpen(true);
    } else {
      setBlackoutNoticeOpen(false);
    }
  }, [bringInRestricted]);

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
  const [locationWarning, setLocationWarning] = useState<
    | {
        title: string;
        description?: string;
      }
    | null
  >(null);
  const showLocationPopup = useCallback(
    (title: string, description?: string) => {
      setLocationWarning({ title, description });
    },
    []
  );

  const [startAuto, setStartAuto] = useState<google.maps.places.Autocomplete | null>(null);
  const [endAuto, setEndAuto] = useState<google.maps.places.Autocomplete | null>(null);

  const [isPlanned, setIsPlanned] = useState(false);
  const [plannerLocked, setPlannerLocked] = useState(true);
  const [resetCounter, setResetCounter] = useState(0);
  const [userMoved, setUserMoved] = useState(false);
  const [forceFit, setForceFit] = useState(false);

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const [routeSummary, setRouteSummary] = useState<{
    distanceKm: number;
    travelMinutes: number;
    jobCount: number;
  } | null>(null);
  const [isRouteSummaryLoading, setIsRouteSummaryLoading] = useState(false);
  const [routeSummaryError, setRouteSummaryError] = useState<string | null>(null);

  const MELBOURNE_BOUNDS = { north: -37.5, south: -38.3, east: 145.5, west: 144.4 };

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
    libraries: LIBRARIES,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (allJobsRestricted) {
      hasRedirectedToRoute.current = false;
      setPlannerLocked(false);
      setIsPlanned(false);
      setJobs([]);
      setOrdered([]);
      setRoutePath([]);
      setStart(null);
      setEnd(null);
      setStartAddress("");
      setEndAddress("");
      setHiddenJobsCount(0);
      return;
    }

    const stored = readPlannedRun();
    if (stored) {
      const filteredJobs = filterJobsForVisibility(stored.jobs);
      const hiddenFromStored = stored.jobs.length - filteredJobs.length;

      setPlannerLocked(true);
      setIsPlanned(true);
      setJobs(filteredJobs);
      setStart({ lat: stored.start.lat, lng: stored.start.lng });
      setEnd({ lat: stored.end.lat, lng: stored.end.lng });
      setStartAddress(stored.startAddress ?? "");
      setEndAddress(stored.endAddress ?? "");
      setOrdered(filteredJobs);
      setRoutePath([]);
      setHiddenJobsCount(hiddenFromStored);
      if (
        stored.hasStarted &&
        filteredJobs.length &&
        !hasRedirectedToRoute.current
      ) {
        hasRedirectedToRoute.current = true;
        redirectToRoute(filteredJobs, stored.start, stored.end);
      } else if (!stored.hasStarted) {
        hasRedirectedToRoute.current = false;
      }
      return;
    }

    hasRedirectedToRoute.current = false;
    setPlannerLocked(false);
    setHiddenJobsCount(0);
  }, [allJobsRestricted, filterJobsForVisibility, redirectToRoute]);

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
        if (allJobsRestricted) {
          console.log("Job visibility restricted for all job types. Skipping job fetch.");
          setJobs([]);
          setHiddenJobsCount(0);
          return;
        }

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
        const overrideDay = process.env.NEXT_PUBLIC_DEV_DAY_OVERRIDE;
        const now = new Date();

        const todayName = overrideDay || getOperationalDayName(now);
        const todayIndex = overrideDay ? now.getDay() : getOperationalDayIndex(now);

        // ✅ log all main variables in one place
        console.log("Debug snapshot:", {
          userId: user.id,
          assigneeId,
          email: user.email,
          todayName,
          todayIndex,
          nowISO: now.toISOString(),
        });

        // Jobs query
        const { data, error } = await supabase
          .from("jobs")
          .select(
            "id, account_id, property_id, address, lat, lng, job_type, bins, notes, client_name, photo_path, last_completed_on, assigned_to, day_of_week"
          )
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

          const visibleJobs = filterJobsForVisibility(availableJobs);

          console.log("Available jobs after filter:", visibleJobs);
          setHiddenJobsCount(availableJobs.length - visibleJobs.length);
          setJobs(visibleJobs);
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
  }, [allJobsRestricted, filterJobsForVisibility, supabase]);


  // Fit bounds helper
  const fitBoundsToMap = useCallback(() => {
    if (!mapRef.current) return;
    const bounds = new google.maps.LatLngBounds();

    const map = mapRef.current;
    const isMobileView =
      typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;

    const adjustViewAfterFit = () => {
      const currentZoom = map.getZoom() ?? 0;
      const zoomBoost = isMobileView ? Math.max(1.2, currentZoom * 0.2) : 0.75;
      map.setZoom(Math.min(21, currentZoom + zoomBoost));

      if (isMobileView) {
        const span = bounds.toSpan();
        const center = bounds.getCenter();
        map.setCenter({
          lat: center.lat() + span.lat() * 0.3,
          lng: center.lng(),
        });
      }
    };

    if (jobs.length === 0) {
      // ✅ No jobs → zoom out to Melbourne
      bounds.extend({ lat: MELBOURNE_BOUNDS.north, lng: MELBOURNE_BOUNDS.east });
      bounds.extend({ lat: MELBOURNE_BOUNDS.south, lng: MELBOURNE_BOUNDS.west });
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 200, left: 50 });
      map.setZoom(10);
      adjustViewAfterFit();
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
      map.fitBounds(bounds, { top: 20, right: 40, bottom: isMobileView ? 280 : 300, left: 40 });
      adjustViewAfterFit();
      setForceFit(false);
    }
  }, [
    start,
    end,
    jobs,
    ordered,
    routePath,
    userMoved,
    forceFit,
    MELBOURNE_BOUNDS.east,
    MELBOURNE_BOUNDS.north,
    MELBOURNE_BOUNDS.south,
    MELBOURNE_BOUNDS.west,
  ]);

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

  const requestStartFromLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      console.warn("Geolocation API unavailable. Unable to auto-fill start location.");
      setLocationAllowed(false);
      showLocationPopup("Location is off", "Turn it on to plan your run.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        console.log("Got browser geolocation:", coords);
        setLocationAllowed(true);
        setLocationWarning(null);
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
      },
      (err) => {
        console.warn("Unable to read current location for planner:", err);
        setLocationAllowed(false);
        showLocationPopup("Location blocked", "Allow sharing to plan and finish jobs.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [showLocationPopup]);

  // Autofill current location
  useEffect(() => {
    requestStartFromLocation();
  }, [requestStartFromLocation, showLocationPopup]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;

    let isActive = true;
    let permissionStatus: PermissionStatus | null = null;

    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (!isActive) return;
        permissionStatus = status;

        const syncPermissionState = () => {
          if (!isActive) return;
          if (status.state === "granted") {
            setLocationWarning(null);
            setLocationAllowed(true);
            requestStartFromLocation();
          } else if (status.state === "denied") {
            setLocationAllowed(false);
            showLocationPopup("Location needed", "Turn it on to plan and mark arrivals.");
          } else {
            // "prompt" state: do not show a popup until the user explicitly denies access
            setLocationAllowed(false);
          }
        };

        syncPermissionState();
        status.onchange = syncPermissionState;
      })
      .catch((err) => console.warn("Unable to check geolocation permission", err));

    return () => {
      isActive = false;
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, [requestStartFromLocation, showLocationPopup]);

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

  const redirectExistingPlan = useCallback(
    (options?: { resetNextIdx?: boolean }) => {
      const stored = readPlannedRun();
      if (stored) {
        const planToPersist = {
          ...stored,
          hasStarted: true,
          nextIdx: options?.resetNextIdx ? 0 : stored.nextIdx ?? 0,
          createdAt: stored.hasStarted
            ? stored.createdAt
            : new Date().toISOString(),
        };

        if (!stored.hasStarted || options?.resetNextIdx) {
          writePlannedRun(planToPersist);
        }

        hasRedirectedToRoute.current = true;
        redirectToRoute(planToPersist.jobs, planToPersist.start, planToPersist.end);
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
          nextIdx: 0,
        });

        hasRedirectedToRoute.current = true;
        redirectToRoute(ordered, start, end);
        return true;
      }

      return false;
    },
    [end, endAddress, ordered, redirectToRoute, start, startAddress]
  );

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

    redirectExistingPlan({ resetNextIdx: true });
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
    requestStartFromLocation();
  }, [requestStartFromLocation]);

  // Build route
  const buildRoute = async () => {
    console.log("Building route with:", { start, end, jobs });
    if (!start || !end || jobs.length === 0) {
      setPlannerNotice({ title: "Need start, end, and jobs" });
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
    if (!resp.ok || !opt?.polyline) {
      setPlannerNotice({ title: "Could not build route." });
      return;
    }

    const plannedJobs = (opt.order || []).map((i: number) => jobs[i]);
    if (!plannedJobs.length) {
      setPlannerNotice({ title: "Could not build route." });
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
      nextIdx: 0,
    });

    setPlannerLocked(true);
    hasRedirectedToRoute.current = false;
  };

  const handlePlanRun = () => {
    if (!locationAllowed) {
      showLocationPopup("Turn on location", "Allow location to plan this run.");
      requestStartFromLocation();
      return;
    }

    console.log("Planning run…");
    buildRoute();
  };

  useEffect(() => {
    if (
      !isLoaded ||
      !isPlanned ||
      !start ||
      !end ||
      typeof window === "undefined" ||
      !window.google?.maps
    ) {
      setRouteSummary(null);
      setRouteSummaryError(null);
      setIsRouteSummaryLoading(false);
      return;
    }

    const activeJobs = ordered.length ? ordered : jobs;
    const jobPoints = activeJobs.map((job) => ({ lat: job.lat, lng: job.lng }));
    const points: google.maps.LatLngLiteral[] = [start, ...jobPoints, end];

    if (points.length < 2) {
      setRouteSummary(null);
      setRouteSummaryError(null);
      setIsRouteSummaryLoading(false);
      return;
    }

    const legs: { origin: google.maps.LatLngLiteral; destination: google.maps.LatLngLiteral }[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      legs.push({ origin: points[i], destination: points[i + 1] });
    }

    if (!legs.length) {
      setRouteSummary(null);
      setRouteSummaryError(null);
      setIsRouteSummaryLoading(false);
      return;
    }

    const service = new google.maps.DirectionsService();
    let isCancelled = false;

    const fetchRouteForLeg = (leg: { origin: google.maps.LatLngLiteral; destination: google.maps.LatLngLiteral }) => {
      return new Promise<google.maps.DirectionsResult | null>((resolve, reject) => {
        service.route(
          {
            origin: leg.origin,
            destination: leg.destination,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (status === "OK" && result) {
              resolve(result);
            } else if (status === google.maps.DirectionsStatus.ZERO_RESULTS) {
              resolve(null);
            } else {
              reject(new Error(`Directions request failed with status: ${status}`));
            }
          }
        );
      });
    };

    (async () => {
      setIsRouteSummaryLoading(true);
      setRouteSummaryError(null);

      let totalDistance = 0;
      let totalDuration = 0;

      try {
        for (const leg of legs) {
          const result = await fetchRouteForLeg(leg);
          if (isCancelled) return;
          const legData = result?.routes?.[0]?.legs?.[0];
          if (legData) {
            totalDistance += legData.distance?.value ?? 0;
            totalDuration += legData.duration?.value ?? 0;
          }
        }

        const jobCount = activeJobs.filter(
          (job) => job.address?.trim().toLowerCase() !== "end"
        ).length;

        setRouteSummary({
          distanceKm: totalDistance / 1000,
          travelMinutes: totalDuration / 60,
          jobCount,
        });
      } catch (error) {
        console.warn("Failed to build run summary", error);
        if (!isCancelled) {
          setRouteSummary(null);
          setRouteSummaryError("Unable to calculate run details.");
        }
      } finally {
        if (!isCancelled) {
          setIsRouteSummaryLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [isLoaded, isPlanned, start, end, ordered, jobs]);

  const formatDuration = useCallback((minutes: number) => {
    if (!Number.isFinite(minutes)) return "—";
    const safeMinutes = Math.max(0, Math.round(minutes));
    const hours = Math.floor(safeMinutes / 60);
    const mins = safeMinutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }, []);

  const jobsToRender = useMemo(() => (routePath.length > 0 ? ordered : jobs), [jobs, ordered, routePath]);
  const selectedJob = useMemo(
    () => (selectedJobId ? jobsToRender.find((job) => job.id === selectedJobId) ?? null : null),
    [jobsToRender, selectedJobId]
  );

  useEffect(() => {
    if (selectedJobId && !selectedJob) {
      setSelectedJobId(null);
    }
  }, [selectedJob, selectedJobId]);

  if (loading) return <PortalLoadingScreen />;
  if (!isLoaded) return <PortalLoadingScreen message="Loading map…" />;

  const styleMap = mapStylePref === "Dark" ? darkMapStyle : mapStylePref === "Light" ? lightMapStyle : satelliteMapStyle;

  return (
    <>
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
          onClick={() => setSelectedJobId(null)}
        >
          {start && <Marker position={start} icon="http://maps.google.com/mapfiles/ms/icons/green-dot.png" />}
          {jobsToRender.map((j) => {
            console.log("Rendering job marker:", j.address, j.lat, j.lng);
            return (
              <Marker
                key={j.id}
                position={{ lat: j.lat, lng: j.lng }}
                icon={JOB_MARKER_ICON}
                title={j.address}
                onClick={() =>
                  setSelectedJobId((current) => (current === j.id ? null : j.id))
                }
                zIndex={selectedJobId === j.id ? 2 : 1}
                options={{ cursor: "pointer" }}
              />
            );
          })}
          {end && <Marker position={end} icon="http://maps.google.com/mapfiles/ms/icons/red-dot.png" />}
          {routePath.length > 0 && <Polyline path={routePath} options={{ strokeColor: "#E21C21", strokeOpacity: 0.9, strokeWeight: 5 }} />}
          {selectedJob && (
            <OverlayViewF
              position={{ lat: selectedJob.lat, lng: selectedJob.lng }}
              mapPaneName="overlayMouseTarget"
              zIndex={3}
            >
              <div
                className="pointer-events-auto"
                style={{ transform: `translate(-50%, calc(-100% - ${JOB_MARKER_POPUP_OFFSET_PX}px))` }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex flex-col items-center">
                  <div className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-xs text-white shadow-[0_18px_40px_rgba(0,0,0,0.55)] backdrop-blur">
                    <p className="text-sm font-semibold text-white">{selectedJob.address}</p>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-[#E21C21]">
                      {JOB_TYPE_LABELS[selectedJob.job_type]}
                    </p>
                  </div>
                  <div className="-mt-1 h-3 w-3 rotate-45 border border-white/10 bg-black" />
                </div>
              </div>
            </OverlayViewF>
          )}
        </GoogleMap>

        {(routeSummary || isRouteSummaryLoading || routeSummaryError) && (
          <div className="pointer-events-none absolute top-4 right-4 z-20 flex justify-end sm:top-6 sm:right-6">
            <div className="pointer-events-auto inline-flex items-center gap-4 rounded-full border border-white/10 bg-black/80 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur sm:text-sm">
              {isRouteSummaryLoading ? (
                <span className="text-white/70">Calculating route…</span>
              ) : routeSummary ? (
                <>
                  <span className="whitespace-nowrap text-white/70">
                    {routeSummary.jobCount} job{routeSummary.jobCount === 1 ? "" : "s"}
                  </span>
                  <span className="hidden h-4 w-px bg-white/15 sm:block" aria-hidden />
                  <span className="whitespace-nowrap font-semibold">
                    {routeSummary.distanceKm >= 100
                      ? routeSummary.distanceKm.toFixed(0)
                      : routeSummary.distanceKm.toFixed(1)} km
                  </span>
                  <span className="hidden h-4 w-px bg-white/15 sm:block" aria-hidden />
                  <span className="whitespace-nowrap font-semibold">
                    {formatDuration(routeSummary.travelMinutes)}
                  </span>
                </>
              ) : (
                <span className="text-amber-300">
                  {routeSummaryError ?? "Run summary unavailable."}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Overlay controls */}
        <div className="fixed inset-x-0 bottom-0 z-10">
          <div className="bg-black w-full flex flex-col gap-3 p-6 relative">
            <div className="absolute top-0 left-0 w-screen bg-[#E21C21]" style={{ height: "2px" }} />
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
            {locationWarning && (
              <LocationPermissionBanner
                title={locationWarning.title}
                description={locationWarning.description}
              />
            )}

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

            <div className="mt-2 flex items-center justify-between text-sm text-gray-300">
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
                  className="text-white text-sm font-semibold rounded-lg transition hover:bg-gray-700"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="mt-4">
              {allJobsRestricted ? (
                <button
                  className="w-full cursor-not-allowed rounded-lg bg-neutral-900 px-4 py-2 font-semibold text-white opacity-70"
                  disabled
                >
                  Jobs available after 12&nbsp;pm
                </button>
              ) : jobs.length === 0 && hiddenJobsCount > 0 ? (
                <button
                  className="w-full cursor-not-allowed rounded-lg bg-neutral-900 px-4 py-2 font-semibold text-white opacity-70"
                  disabled
                >
                  Bring-in jobs available after 12&nbsp;pm
                </button>
              ) : jobs.length === 0 ? (
                <button
                  className="w-full cursor-not-allowed rounded-lg bg-[#E21C21] px-4 py-2 font-semibold opacity-60"
                  disabled
                >
                  All Jobs Completed
                </button>
              ) : !isPlanned ? (
                // Plan Run button (grey)
                <button
                  className="w-full rounded-lg bg-neutral-900 px-4 py-2 font-semibold text-white transition hover:bg-neutral-800"
                  onClick={handlePlanRun}
                  disabled={plannerLocked}
                >
                  Plan Run
                </button>
              ) : (
                // Start Run button (accent red)
                <button
                  className="w-full rounded-lg bg-[#E21C21] px-4 py-2 font-semibold text-white transition hover:opacity-90"
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

      <NoticeModal
        open={blackoutNoticeOpen && bringInRestricted && hiddenJobsCount > 0}
        title="Bring-in jobs will appear after 12 pm."
        onClose={() => setBlackoutNoticeOpen(false)}
      />
      <NoticeModal
        open={Boolean(plannerNotice)}
        title={plannerNotice?.title ?? ""}
        description={plannerNotice?.description}
        onClose={() => setPlannerNotice(null)}
      />
    </>
  );
}
