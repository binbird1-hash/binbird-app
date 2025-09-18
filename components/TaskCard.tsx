// components/TaskCard.tsx
"use client";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

async function getPosition() {
  return new Promise<{
    lat: number | null;
    lng: number | null;
    acc: number | null;
    t: number | null;
    error: string | null;
  }>((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: null, lng: null, acc: null, t: null, error: "Geolocation not supported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: pos.coords.accuracy,
          t: pos.timestamp,
          error: null,
        }),
      (err) =>
        resolve({
          lat: null,
          lng: null,
          acc: null,
          t: null,
          error: err.message || "denied",
        }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

export default function TaskCard({
  job,
  onCompleted,
}: {
  job: any;
  onCompleted: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleComplete() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      alert("Please take a photo");
      return;
    }

    setSaving(true);
    try {
      const gps = await getPosition();
      if (!gps.lat || !gps.lng) throw new Error("GPS required");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const safeClient = job.client_name.replace(/[^a-z0-9]/gi, "_");
      const ext = file.name.split(".").pop() || "jpg";
      const filename = `${today}-${job.job_type}.${ext}`;
      const path = `${safeClient}/${filename}`;

      const { error: uploadErr } = await supabase.storage.from("proofs").upload(path, file, { upsert: false });
      if (uploadErr) throw uploadErr;

      const { error: logErr } = await supabase.from("logs").insert({
        sorter: job.sorter,
        client_name: job.client_name,
        address: job.address,
        task_type: job.job_type,
        bins: job.bins_this_week,
        notes: job.notes,
        photo_path: path,
        done_on: today,
        gps_lat: gps.lat,
        gps_lng: gps.lng,
        gps_acc: gps.acc,
        gps_time: gps.t ? new Date(gps.t).toISOString() : null,
        user_id: user.id,
      });
      if (logErr) throw logErr;

      onCompleted();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 rounded-2xl shadow bg-white sticky bottom-0">
      <div className="text-lg font-semibold">{job.address}</div>
      <div className="text-sm text-gray-600">{job.client_name}</div>
      <div className="mt-2">Bins: {job.bins_this_week}</div>
      {job.notes && <div className="mt-1 text-sm text-gray-700">Notes: {job.notes}</div>}

      <div className="mt-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPreview(URL.createObjectURL(f));
          }}
        />
        {preview && <img src={preview} alt="preview" className="mt-2 h-32 rounded-lg object-cover" />}
      </div>

      <button
        onClick={handleComplete}
        disabled={saving}
        className="mt-3 w-full py-3 rounded-xl bg-black text-white disabled:opacity-60"
      >
        {saving ? "Saving…" : "Complete & Next →"}
      </button>
    </div>
  );
}
