"use client";

import { useEffect, useRef, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  GoogleMap,
  Marker,
  Polyline,
  useLoadScript,
  Autocomplete,
} from "@react-google-maps/api";
import polyline from "@mapbox/polyline";
import { useRouter } from "next/navigation";
import { darkMapStyle } from "@/lib/mapStyle";

type Job = {
  id: string;
  address: string;
  lat: number;
  lng: number;
  job_type: "put_out" | "bring_in";
  bins?: string | null;
  notes?: string | null;
};

const LIBRARIES: ("places")[] = ["places"];

export default function RunPageContent() {
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

  const [isPlanned, setIsPlanned] = useState(false);

  // 🔁 Key to force-remount the GoogleMap (clears all overlays reliably)
  const [resetCounter, setResetCounter] = useState(0);

  // ✅ Keep map reference for fitBounds
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: LIBRARIES,
  });

  // Load jobs
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

  // ✅ Function to get current location and autofill
  async function fetchCurrentLocation() {
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
  }

  // Autofill start = current location on mount
  useEffect(() => {
    fetchCurrentLocation();
  }, []);

  // Autocomplete change handlers
  function onStartChanged() {
    if (startAuto) {
      const place = startAuto.getPlace();
      const loc = place.geometry?.location;

      if (loc) {
        setStart({
          lat: loc.lat(),
          lng: loc.lng(),
        });
      }

      if (place.formatted_address) {
        setStartAddress(place.formatted_address);

        if (sameAsStart && loc) {
          setEndAddress(place.formatted_address);
          setEnd({
            lat: loc.lat(),
            lng: loc.lng(),
          });
        }
      }
    }
  }

  function onEndChanged() {
    if (endAuto) {
      const place = endAuto.getPlace();
      const loc = place.geometry?.location;

      if (loc) {
        setEnd({
          lat: loc.lat(),
          lng: loc.lng(),
        });
      }
      if (place.formatted_address) {
        setEndAddress(place.formatted_address);
      }
    }
  }

  // Handle same-as-start toggle
  useEffect(() => {
    if (sameAsStart && start && startAddress) {
      setEnd(start);
      setEndAddress(startAddress);
    }
  }, [sameAsStart, start, startAddress]);

  async function buildRoute() {
    if (!start || !end || jobs.length === 0) {
      alert("Need start, end, and jobs");
      return;
    }

    // ✅ Clear old route fully before building new one
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

    // ✅ Auto-fit map after planning route
    if (mapRef.current) {
      const bounds = new google.maps.LatLngBounds();
      if (start) bounds.extend(start);
      if (end) bounds.extend(end);
      reordered.forEach((j) => bounds.extend({ lat: j.lat, lng: j.lng }));
      if (!bounds.isEmpty()) {
        mapRef.current.fitBounds(bounds, {
            top: 50,
            right: 50,
            bottom: 250,  // adjust this value until pins look visually centered
            left: 50,
          });
        
      }
    }
  }

  if (loading) return <div className="p-6 text-white bg-black">Loading jobs…</div>;
  if (!isLoaded) return <div className="p-6 text-white bg-black">Loading map…</div>;

  // Victoria bounds
  const victoriaBounds = new google.maps.LatLngBounds(
    { lat: -39.2, lng: 140.9 },
    { lat: -33.9, lng: 150.1 }
  );

  return (
    <div className="max-w-xl mx-auto min-h-screen bg-black text-white">
      {/* Map with overlay controls */}
      <div className="relative h-[70vh] rounded-xl overflow-hidden">
        <GoogleMap
          key={resetCounter}
          mapContainerStyle={{ width: "100%", height: "100%" }}
          onLoad={(map) => {
            mapRef.current = map;
            const bounds = new google.maps.LatLngBounds();
            if (jobs.length > 0) {
              jobs.forEach((j) => bounds.extend({ lat: j.lat, lng: j.lng }));
            }
            if (start) bounds.extend(start);
            if (end) bounds.extend(end);

            if (!bounds.isEmpty()) {
              map.fitBounds(bounds, {
                top: 50,
                right: 50,
                bottom: 250,  // adjust this value until pins look visually centered
                left: 50,
              });
            } else {
              map.setCenter({ lat: -37.8136, lng: 144.9631 }); // Melbourne fallback
              map.setZoom(12);
            }
          }}
          options={{
            styles: darkMapStyle,
            disableDefaultUI: true,
            zoomControl: false,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            keyboardShortcuts: false,
          }}
        >
          {start && (
            <Marker position={start} icon="http://maps.google.com/mapfiles/ms/icons/green-dot.png" />
          )}
          {end && (
            <Marker position={end} icon="http://maps.google.com/mapfiles/ms/icons/red-dot.png" />
          )}
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

        {/* Overlay controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-black">
          <h1 className="text-xl font-bold mb-2">Plan Run</h1>

          <div className="flex flex-col gap-3">
            <Autocomplete
              onLoad={(auto) => setStartAuto(auto)}
              onPlaceChanged={onStartChanged}
              options={{
                fields: ["geometry", "formatted_address"],
                componentRestrictions: { country: "au" },
                bounds: victoriaBounds,
              }}
            >
              <input
                type="text"
                value={startAddress}
                onChange={(e) => setStartAddress(e.target.value)}
                placeholder="Start Location"
                className="w-full px-3 py-2 rounded-lg text-black disabled:bg-gray-200 disabled:cursor-not-allowed"
                disabled={isPlanned}
              />
            </Autocomplete>

            <Autocomplete
              onLoad={(auto) => setEndAuto(auto)}
              onPlaceChanged={onEndChanged}
              options={{
                fields: ["geometry", "formatted_address"],
                componentRestrictions: { country: "au" },
                bounds: victoriaBounds,
              }}
            >
              <input
                type="text"
                value={endAddress}
                onChange={(e) => setEndAddress(e.target.value)}
                placeholder="End Location"
                className="w-full px-3 py-2 rounded-lg text-black disabled:bg-gray-200 disabled:cursor-not-allowed"
                disabled={sameAsStart || isPlanned}
              />
            </Autocomplete>

            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={sameAsStart}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setSameAsStart(checked);
                  if (checked && start) {
                    setEnd(start);
                    setEndAddress(startAddress);
                  } else {
                    setEnd(null);
                    setEndAddress("");
                  }
                }}
                disabled={isPlanned}
              />
              End same as Start
            </label>

            <div className="flex flex-col gap-2 mt-2">
              <button
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
                className={`w-full px-4 py-2 rounded-lg font-semibold transition ${
                  isPlanned ? "bg-green-600 hover:bg-green-700" : "bg-[#ff5757] hover:opacity-90"
                }`}
              >
                {isPlanned ? "Start Route" : "Plan Route"}
              </button>

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

                    // ✅ Re-fetch current location again after reset
                    fetchCurrentLocation();
                  }}
                  className="self-center text-xs text-gray-400 hover:text-white"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
