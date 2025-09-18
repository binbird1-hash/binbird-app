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
import SmartJobCard from "@/components/SmartJobCard";

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
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
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

  const activeJob = jobs[activeIdx];

  // Request route whenever start or activeJob changes
  useEffect(() => {
    if (!isLoaded) return;
    if (!activeJob || !start) return;

    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin: start,
        destination: { lat: activeJob.lat, lng: activeJob.lng },
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
  }, [isLoaded, start, activeJob]);

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
      // 👇 Always apply your own padding so it won’t snap back
      mapRef.fitBounds(bounds, {
        top: 50,
        right: 50,
        bottom: 800, // enough space for bottom card
        left: 50,
      });
    }
  }, [mapRef, directions, start, activeJob]);

  function onCompleted() {
    if (!activeJob) return;

    const next = activeIdx + 1;
    setStart({ lat: activeJob.lat, lng: activeJob.lng });

    if (next < jobs.length) {
      setActiveIdx(next);
      setDirections(null);
    } else {
      alert("All jobs done 🎉");
      router.push("/staff/run");
    }
  }

  if (!isLoaded) return <div className="p-6 text-white bg-black">Loading map…</div>;
  if (!activeJob) return <div className="p-6 text-white bg-black">No jobs found.</div>;

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
          {/* Start marker */}
          {start && (
            <Marker
              position={start}
              icon="http://maps.google.com/mapfiles/ms/icons/green-dot.png"
            />
          )}

          {/* Active job marker */}
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

        {/* Overlay job card */}
        <div className="fixed inset-x-0 bottom-0 z-10">
          <div className="bg-black w-full flex flex-col gap-3">
            <SmartJobCard job={activeJob} onCompleted={onCompleted} />
          </div>
        </div>
      </div>
    </div>
  );
}
