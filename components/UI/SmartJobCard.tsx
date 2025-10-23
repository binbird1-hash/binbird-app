"use client";
import { useState, useEffect } from "react";
import type { Job } from "@/lib/jobs";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { getOperationalISODate } from "@/lib/date";

export default function SmartJobCard({
  job,
  onCompleted,
}: {
  job: Job;
  onCompleted: () => void;
}) {
  const supabase = useSupabase();

  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [navPref, setNavPref] = useState<"google" | "waze" | "apple">("google");

  useEffect(() => {
    const stored = localStorage.getItem("navPref");
    if (stored === "waze" || stored === "apple" || stored === "google") {
      setNavPref(stored);
    }
  }, []);

  async function handleMarkDone() {
    if (!file) {
      alert("Please upload a photo first.");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const now = new Date();
      const dateStr = getOperationalISODate(now);
      const safeTimestamp = now.toISOString().replace(/[:.]/g, "-");

      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${job.id}-${safeTimestamp}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("proofs")
        .upload(path, file, { upsert: false });
      if (uploadErr) throw uploadErr;

      let position: GeolocationPosition | null = null;
      if (navigator.geolocation) {
        position = await new Promise<GeolocationPosition | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos),
            (err) => {
              console.error("Geolocation error", err);
              resolve(null);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
          );
        });
      }

      const propertyNote = typeof job.notes === "string" ? job.notes.trim() : "";
      const combinedNotes = propertyNote ? propertyNote : null;

      if (!job.account_id) {
        throw new Error("Unable to log completion: missing account identifier for job.");
      }

      const { error: logErr } = await supabase.from("logs").insert({
        job_id: job.id,
        account_id: job.account_id,
        client_name: job.client_name ?? null,
        address: job.address,
        task_type: job.job_type,
        bins: job.bins ?? null,
        notes: combinedNotes,
        photo_path: path,
        done_on: dateStr,
        gps_lat: position?.coords.latitude ?? null,
        gps_lng: position?.coords.longitude ?? null,
        gps_acc: position?.coords.accuracy ?? null,
        gps_time: position ? new Date(position.timestamp).toISOString() : null,
        user_id: user.id,
      });
      if (logErr) throw logErr;

      const { error: updateErr } = await supabase
        .from("jobs")
        .update({ last_completed_on: dateStr })
        .eq("id", job.id);
      if (updateErr) throw updateErr;

      onCompleted();
    } catch (e: any) {
      alert("Error saving: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  function openNavigation() {
    let url = "";
    if (navPref === "google") {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        `${job.lat},${job.lng}`
      )}`;
    } else if (navPref === "waze") {
      url = `https://waze.com/ul?ll=${job.lat},${job.lng}&navigate=yes`;
    } else if (navPref === "apple") {
      url = `http://maps.apple.com/?daddr=${job.lat},${job.lng}`;
    }
    window.open(url, "_blank");
  }

  function renderBins(bins: string | null | undefined) {
    if (!bins) return <span className="text-gray-400">—</span>;
    return bins.split(",").map((b) => {
      const bin = b.trim().toLowerCase();
      let color = "bg-gray-600";
      if (bin.includes("red")) color = "bg-red-600";
      else if (bin.includes("yellow")) color = "bg-yellow-500 text-black";
      else if (bin.includes("green")) color = "bg-green-600";

      return (
        <span
          key={bin}
          className={`${color} px-3 py-1 rounded-full text-xs font-semibold ml-2`}
        >
          {bin.charAt(0).toUpperCase() + bin.slice(1)}
        </span>
      );
    });
  }

  return (
    <article className="bg-black w-full p-6 flex flex-col gap-3 text-white">
      <h2 className="text-2xl font-bold">
        {job.job_type === "put_out" ? "Put Bins Out At" : "Bring Bins In At"}
      </h2>

      <p className="text-gray-300">{job.address}</p>
      {job.notes && (
        <p className="text-sm text-gray-400">Notes: {job.notes}</p>
      )}

      <p className="font-semibold">Bins: {renderBins(job.bins)}</p>

      <div className="flex flex-col gap-3">
        {/* Navigate */}
        <button
          onClick={openNavigation}
          className="w-full bg-[#ff5757] px-4 py-2 rounded-lg font-semibold hover:opacity-90"
        >
          Navigate
        </button>

        {/* Take photo */}
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            id={`photo-${job.id}`}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                setPreview(URL.createObjectURL(f));
              }
            }}
          />
          <label
            htmlFor={`photo-${job.id}`}
            className="w-full cursor-pointer bg-gray-800 px-4 py-2 rounded-lg hover:bg-gray-700 text-center"
          >
            {preview ? "Retake Photo ✓" : "Take Photo"}
          </label>
        </div>
        {preview && (
          <img
            src={preview}
            alt="preview"
            className="w-16 h-16 object-cover rounded-lg"
          />
        )}

        {/* Mark Done */}
        <button
          onClick={handleMarkDone}
          disabled={saving}
          className="w-full bg-green-600 px-4 py-2 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Mark Done"}
        </button>
      </div>
    </article>
  );
}
