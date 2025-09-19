"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { darkMapStyle } from "@/lib/mapStyle";
import {
  GoogleMap,
  Marker,
  DirectionsRenderer,
  useLoadScript,
} from "@react-google-maps/api";

type Job = {
  id: string;
  address: string;
  lat: number;
  lng: number;
  job_type: "put_out" | "bring_in";
  bins?: string | null;
  notes?: string | null;
};

export default function RoutePageContent() {
  const params = useSearchParams();
  const router = useRouter();

  const [start, setStart] = useState<{ lat: number; lng: number } | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [directions, setDirections] =
    useState<google.maps.DirectionsResult | null>(null);
  const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
  });

  // Parse jobs + start from query
  useEffect(() => {
    const rawJobs = params.get("jobs");
    const rawStart = params.get("start");

    try {
      if (rawJobs) setJobs(JSON.parse(rawJobs));
      if (rawStart) setStart(JSON.parse(rawStart));
    } catch (err) {
      console.error("Parse failed:", err);
    }
  }, [params]);

  // Pick up nextIdx when returning from proof page
  useEffect(() => {
    const rawNextIdx = params.get("nextIdx");
    if (rawNextIdx) {
      const parsed = parseInt(rawNextIdx, 10);
      if (!isNaN(parsed)) {
        setActiveIdx(parsed);
      }
    }
  }, [params]);

  const activeJob = jobs[activeIdx];

  // Request route step-by-step
  useEffect(() => {
    if (!isLoaded) return;
    if (!jobs.length) return;
    if (!activeJob) return;

    const service = new google.maps.DirectionsService();

    // Origin = last completed job OR original start
    const origin =
      activeIdx > 0
        ? { lat: jobs[activeIdx - 1].lat, lng: jobs[activeIdx - 1].lng }
        : start!;

    const destination = {
      lat: activeJob.lat,
      lng: activeJob.lng,
    };

    service.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === "OK" && result) {
          setDirections(result);
        } else {
          console.warn("❌ Directions request failed:", status, result);
          setDirections(null);
        }
      }
    );
  }, [isLoaded, jobs, activeIdx, start, activeJob]);

  // Auto-fit bounds when directions or markers change
  useEffect(() => {
    if (!mapRef) return;

    const bounds = new google.maps.LatLngBounds();
    if (directions) {
      directions.routes[0].overview_path.forEach((p) => bounds.extend(p));
    } else if (start && activeJob) {
      bounds.extend(start);
      bounds.extend({ lat: activeJob.lat, lng: activeJob.lng });
    }

    if (!bounds.isEmpty()) {
      mapRef.fitBounds(bounds, {
        top: 50,
        right: 50,
        bottom: 500,
        left: 50,
      });
    }
  }, [mapRef, directions, start, activeJob]);

  // Distance calculation (Haversine formula)
  function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // Earth radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) *
        Math.cos(φ2) *
        Math.sin(Δλ / 2) *
        Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
  }

  function handleArrivedAtLocation() {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

        const dist = haversine(userLat, userLng, activeJob.lat, activeJob.lng);

        if (dist <= 25) {
          router.push(
            `/staff/proof?jobs=${encodeURIComponent(
              JSON.stringify(jobs)
            )}&idx=${activeIdx}&total=${jobs.length}`
          );
        } else {
          alert(
            `You are too far from the job location. (${Math.round(dist)}m away)`
          );
        }
      },
      (err) => {
        console.error("Geolocation error", err);
        alert("Unable to get your current location.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  if (!isLoaded)
    return <div className="p-6 text-white bg-black">Loading map…</div>;
  if (!activeJob)
    return <div className="p-6 text-white bg-black">No jobs found.</div>;

  return (
    <div className="flex flex-col min-h-screen max-w-xl mx-auto bg-black text-white">
      {/* Map */}
      <div className="relative h-[150vh]">
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={start || { lat: activeJob.lat, lng: activeJob.lng }}
          zoom={13}
          options={{
            styles: darkMapStyle,
            disableDefaultUI: true,
            zoomControl: false,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            keyboardShortcuts: false,
          }}
          onLoad={(map) => setMapRef(map)}
        >
          {/* Completed job OR original start (green) */}
          {activeIdx > 0 ? (
            <Marker
              position={{
                lat: jobs[activeIdx - 1].lat,
                lng: jobs[activeIdx - 1].lng,
              }}
              icon="http://maps.google.com/mapfiles/ms/icons/green-dot.png"
            />
          ) : (
            start && (
              <Marker
                position={start}
                icon="http://maps.google.com/mapfiles/ms/icons/green-dot.png"
              />
            )
          )}

          {/* Active job (blue) */}
          <Marker
            position={{ lat: activeJob.lat, lng: activeJob.lng }}
            icon="http://maps.google.com/mapfiles/ms/icons/ltblue-dot.png"
          />

          {/* Driving route */}
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

        {/* Overlay */}
        <div className="fixed inset-x-0 bottom-0 z-10">
          <div className="bg-black w-full flex flex-col gap-3 p-6">
            <h2 className="text-lg font-bold">{activeJob.address}</h2>

            <button
              onClick={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                  `${activeJob.lat},${activeJob.lng}`
                )}`;
                window.open(url, "_blank");
              }}
              className="w-full bg-[#ff5757] px-4 py-2 rounded-lg font-semibold hover:opacity-90"
            >
              Navigate
            </button>

            <button
              onClick={handleArrivedAtLocation}
              className="w-full bg-green-600 px-4 py-2 rounded-lg font-semibold hover:bg-green-700"
            >
              Arrived At Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
