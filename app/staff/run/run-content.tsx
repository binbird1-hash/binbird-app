"use client";

import { useEffect, useRef, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { MapSettingsProvider } from "@/components/Context/MapSettingsContext";
import {
  GoogleMap,
  Marker,
  Polyline,
  useLoadScript,
  Autocomplete,
} from "@react-google-maps/api";
import polyline from "@mapbox/polyline";
import { useRouter } from "next/navigation";
import SettingsDrawer from "@/components/UI/SettingsDrawer";
import { darkMapStyle, lightMapStyle, satelliteMapStyle } from "@/lib/mapStyle";

type Job = {
  id: string;
  address: string;
  lat: number;
  lng: number;
  job_type: "put_out" | "bring_in";
  bins?: string | null;
  notes?: string | null;
};

type MapStyleOption = "Dark" | "Light" | "Satellite";
type NavOption = "google" | "waze" | "apple";

const LIBRARIES: ("places")[] = ["places"];

export default function RunPage() {
  const [mapStylePref, setMapStylePref] = useState<MapStyleOption>("Dark");
  const [navPref, setNavPref] = useState<NavOption>("google"); // optional for future navigation links

  return (
    <div className="relative min-h-screen bg-black text-white">
      <SettingsDrawer
        onMapStyleChange={(style) => setMapStylePref(style)}
        onNavChange={(nav) => setNavPref(nav)}
      />
      <RunPageContent mapStylePref={mapStylePref} navPref={navPref} />
    </div>
  );
}

interface RunPageContentProps {
  mapStylePref: MapStyleOption;
  navPref: NavOption;
}

function RunPageContent({ mapStylePref, navPref }: RunPageContentProps) {
  const supabase = createClientComponentClient();
  const router = useRouter();

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

  // Rough bounding box around Melbourne
  const MELBOURNE_BOUNDS = {
    north: -37.5,   // top
    south: -38.3,   // bottom
    east: 145.5,    // right
    west: 144.4,    // left
  };

  const [isPlanned, setIsPlanned] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);

  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: LIBRARIES,
  });

  // Load jobs from Supabase
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const todayName =
          process.env.NEXT_PUBLIC_DEV_DAY_OVERRIDE ||
          new Date().toLocaleDateString("en-US", { weekday: "long" });

        const { data, error } = await supabase
          .from("jobs")
          .select("*")
          .eq("assigned_to", user.id)
          .eq("day_of_week", todayName);

        if (!error && data) setJobs(data as Job[]);
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
      try {
        const resp = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.lat},${coords.lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
        );
        const data = await resp.json();
        if (data.results && data.results[0]?.formatted_address) {
          setStartAddress(data.results[0].formatted_address);
        }
      } catch (err) {
        console.error("Reverse geocoding failed:", err);
      }
    });
  }, []);

  // Start/End Autocomplete handlers
  function onStartChanged() {
    if (startAuto) {
      const place = startAuto.getPlace();
      const loc = place.geometry?.location;
      if (loc) setStart({ lat: loc.lat(), lng: loc.lng() });
      if (place.formatted_address) {
        setStartAddress(place.formatted_address);
        if (sameAsStart && loc) {
          setEndAddress(place.formatted_address);
          setEnd({ lat: loc.lat(), lng: loc.lng() });
        }
      }
    }
  }
  function onEndChanged() {
    if (endAuto) {
      const place = endAuto.getPlace();
      const loc = place.geometry?.location;
      if (loc) setEnd({ lat: loc.lat(), lng: loc.lng() });
      if (place.formatted_address) setEndAddress(place.formatted_address);
    }
  }

  useEffect(() => {
    if (sameAsStart && start && startAddress) {
      setEnd(start);
      setEndAddress(startAddress);
    } else if (!sameAsStart) {
      // Clear end location when unchecked
      setEnd(null);
      setEndAddress("");
    }
    fitBoundsToMap();
  }, [sameAsStart, start, startAddress]);



  // Reusable function to fit map bounds
  function fitBoundsToMap() {
    if (!mapRef.current) return;
    const bounds = new google.maps.LatLngBounds();

    if (start) bounds.extend(start);
    if (end) bounds.extend(end);
    (routePath.length ? ordered : jobs).forEach((j) =>
      bounds.extend({ lat: j.lat, lng: j.lng })
    );

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, {
        top: 50,
        right: 50,
        bottom: 700,
        left: 50,
      });
    }
  }


  // Auto-fit whenever relevant data changes
  useEffect(() => {
    fitBoundsToMap();
  }, [jobs, start, end, routePath, ordered, isPlanned, resetCounter]);

  
  async function buildRoute() {
    if (!start || !end || jobs.length === 0) {
      alert("Need start, end, and jobs");
      return;
    }

    setRoutePath([]);
    setOrdered([]);
    setIsPlanned(false);

    const middle = jobs.map((j) => ({ lat: j.lat, lng: j.lng }));

    const resp = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start, end, waypoints: middle }),
    });
    const opt = await resp.json();

    if (!resp.ok || !opt?.polyline) {
      alert("Could not build route.");
      return;
    }

    const decoded = polyline.decode(opt.polyline).map((c) => ({ lat: c[0], lng: c[1] }));
    setRoutePath(decoded);

    const order: number[] = opt.order || [];
    const reordered = order.map((i) => jobs[i]);
    setOrdered(reordered);

    setIsPlanned(true);

    fitBoundsToMap(); // refit map after planning
  }

  if (loading) return <div className="p-6 text-white bg-black">Loading jobs…</div>;
  if (!isLoaded) return <div className="p-6 text-white bg-black">Loading map…</div>;

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
          key={resetCounter}
          mapContainerStyle={{ width: "100%", height: "100%" }}
          onLoad={(map) => {
            mapRef.current = map;
          }}
          options={{
            styles: styleMap,
            disableDefaultUI: true,
            zoomControl: false,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            keyboardShortcuts: false,
          }}
        >
          {start && <Marker position={start} icon="http://maps.google.com/mapfiles/ms/icons/green-dot.png" />}
          {end && <Marker position={end} icon="http://maps.google.com/mapfiles/ms/icons/red-dot.png" />}
          {!routePath.length &&
            jobs.map((j) => (
              <Marker
                key={j.id}
                position={{ lat: j.lat, lng: j.lng }}
                icon="http://maps.google.com/mapfiles/ms/icons/ltblue-dot.png"
              />
            ))}
          {routePath.length > 0 &&
            ordered.map((j) => (
              <Marker
                key={j.id}
                position={{ lat: j.lat, lng: j.lng }}
                icon="http://maps.google.com/mapfiles/ms/icons/ltblue-dot.png"
              />
            ))}
          {routePath.length > 0 && (
            <Polyline
              path={routePath}
              options={{ strokeColor: "#ff5757", strokeOpacity: 0.9, strokeWeight: 5 }}
            />
          )}
        </GoogleMap>

        {/* Overlay */}
        <div className="fixed inset-x-0 bottom-0 z-10">
          <div className="bg-black w-full flex flex-col gap-3">
            <div className="p-6 flex flex-col gap-3">
              <h1 className="text-xl font-bold text-white">Plan Run</h1>

              {/* Start Autocomplete */}
              <Autocomplete
                onLoad={(auto) => setStartAuto(auto)}
                onPlaceChanged={onStartChanged}
                options={{
                  bounds: MELBOURNE_BOUNDS,
                  strictBounds: true,
                  fields: ["geometry", "formatted_address"],
                }}
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

              {/* End Autocomplete */}
              <Autocomplete
                onLoad={(auto) => setEndAuto(auto)}
                onPlaceChanged={onEndChanged}
                options={{
                  bounds: MELBOURNE_BOUNDS,
                  strictBounds: true,
                  fields: ["geometry", "formatted_address"],
                }}
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

              {/* Same as Start checkbox */}
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={sameAsStart}
                  onChange={(e) => setSameAsStart(e.target.checked)}
                  disabled={isPlanned}
                />
                End same as Start
              </label>


              <div className="flex flex-col gap-2 mt-2 pb-2">
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

                <div className="min-h-[24px] flex items-center justify-center">
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
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition((pos) =>
                            setStart({ lat: pos.coords.latitude, lng: pos.coords.longitude })
                          );
                        }
                        setTimeout(() => {
                          fitBoundsToMap();
                        }, 0);
                      }}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Reset
                    </button>
                    
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
