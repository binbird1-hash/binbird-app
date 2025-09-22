"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { GoogleMap, Marker, DirectionsRenderer, useLoadScript } from "@react-google-maps/api";
import SettingsDrawer from "@/components/UI/SettingsDrawer";
import { darkMapStyle, lightMapStyle, satelliteMapStyle } from "@/lib/mapStyle";
import { MapSettingsProvider, useMapSettings } from "@/components/Context/MapSettingsContext";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { normalizeJobs, type Job } from "@/lib/jobs";


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
  const [currentLocation, setCurrentLocation] = useState<
    google.maps.LatLngLiteral | null
  >(null);

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

  const originLatLng = useMemo(() => {
    if (currentLocation) return currentLocation;
    if (previousJob) return { lat: previousJob.lat, lng: previousJob.lng };
    return start;
  }, [currentLocation, previousJob, start]);

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
        if (!isCancelled) {
          setCurrentLocation(null);
        }
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
    if (currentLocation) origin = currentLocation;
    else if (activeIdx > 0 && previousJob)
      origin = { lat: previousJob.lat, lng: previousJob.lng };
    else if (start) origin = start;

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
        if (status === "OK" && result) setDirections(result);
        else {
          console.warn("❌ Directions request failed:", status, result);
          setDirections(null);
        }
      }
    );

    return () => {
      isCancelled = true;
    };
  }, [
    isLoaded,
    jobs,
    activeIdx,
    start,
    activeJob,
    currentLocation,
    previousJob,
    isEndStop,
  ]);

  // Fit map bounds
  useEffect(() => {
    if (!mapRef) return;
    const bounds = new google.maps.LatLngBounds();
    if (directions)
      directions.routes[0].overview_path.forEach((p) => bounds.extend(p));
    else {
      if (originLatLng) bounds.extend(originLatLng);
      if (activeJob) bounds.extend({ lat: activeJob.lat, lng: activeJob.lng });
    }
    if (!bounds.isEmpty())
      mapRef.fitBounds(bounds, { top: 50, right: 50, bottom: 700, left: 50 });
  }, [mapRef, directions, originLatLng, activeJob]);

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
    if (!navigator.geolocation) return alert("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = haversine(pos.coords.latitude, pos.coords.longitude, activeJob.lat, activeJob.lng);
        if (dist <= 25000)
          router.push(
            `/staff/proof?jobs=${encodeURIComponent(JSON.stringify(jobs))}&idx=${activeIdx}&total=${jobs.length}`
          );
        else alert(`You are too far from the job location. (${Math.round(dist)}m away)`);
      },
      (err) => {
        console.error("Geolocation error", err);
        alert("Unable to get your current location.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  if (!isLoaded) return <div className="p-6 text-white bg-black">Loading map…</div>;
  if (!activeJob) return <div className="p-6 text-white bg-black">No jobs found.</div>;

  // Determine URL based on preference
  const navigateUrl =
    navPref === "google"
      ? `https://www.google.com/maps/dir/?api=1&destination=${activeJob.lat},${activeJob.lng}`
      : navPref === "waze"
      ? `https://waze.com/ul?ll=${activeJob.lat},${activeJob.lng}&navigate=yes`
      : `http://maps.apple.com/?daddr=${activeJob.lat},${activeJob.lng}&dirflg=d`;

  // Determine map style
  const styleMap =
    mapStylePref === "Dark"
      ? darkMapStyle
      : mapStylePref === "Light"
      ? lightMapStyle
      : satelliteMapStyle;

  return (
    <div className="flex flex-col min-h-screen max-w-xl mx-auto bg-black text-white">
      <div className="relative h-[150vh]">
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={originLatLng || { lat: activeJob.lat, lng: activeJob.lng }}
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
          {originLatLng && (
            <Marker position={originLatLng} icon="http://maps.google.com/mapfiles/ms/icons/green-dot.png" />
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
            <button
              onClick={() => window.open(navigateUrl, "_blank")}
              className="w-full bg-[#ff5757] px-4 py-2 rounded-lg font-semibold hover:opacity-90 relative z-10"
            >
              Navigate
            </button>
            <button
              onClick={handleArrivedAtLocation}
              className="w-full bg-green-600 px-4 py-2 rounded-lg font-semibold hover:bg-green-700 relative z-10"
            >
              Arrived At Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RoutePage() {
  return (
    <MapSettingsProvider>
      <div className="relative min-h-screen bg-black text-white">
        <SettingsDrawer />
        <RoutePageContent />
      </div>
    </MapSettingsProvider>
  );
}
