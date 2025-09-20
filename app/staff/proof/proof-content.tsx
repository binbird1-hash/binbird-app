"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type Job = {
  id: string;
  address: string;
  job_type: "put_out" | "bring_in";
  bins?: string | null;
  notes?: string | null;
  lat: number;
  lng: number;
  client_name: string | null;
};

export default function ProofPageContent() {
  const supabase = createClientComponentClient();
  const params = useSearchParams();
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [idx, setIdx] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [showInstructions, setShowInstructions] = useState(true); // 🔥 open by default
  const [submitting, setSubmitting] = useState(false);

  const [gpsData, setGpsData] = useState<{
    lat: number | null;
    lng: number | null;
    acc: number | null;
    time: string | null;
  }>({ lat: null, lng: null, acc: null, time: null });
  const [gpsError, setGpsError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Parse jobs, idx, total
  useEffect(() => {
    try {
      const rawJobs = params.get("jobs");
      const rawIdx = params.get("idx");
      const rawTotal = params.get("total");

      if (rawJobs) {
        const parsed = JSON.parse(rawJobs);
        if (Array.isArray(parsed)) {
          const normalized = parsed.map((j: any): Job => {
            const lat = typeof j?.lat === "number" ? j.lat : Number(j?.lat ?? 0);
            const lng = typeof j?.lng === "number" ? j.lng : Number(j?.lng ?? 0);
            return {
              id: String(j?.id ?? ""),
              address: String(j?.address ?? ""),
              job_type: j?.job_type === "bring_in" ? "bring_in" : "put_out",
              bins: j?.bins ?? null,
              notes: j?.notes ?? null,
              lat: Number.isFinite(lat) ? lat : 0,
              lng: Number.isFinite(lng) ? lng : 0,
              client_name:
                j?.client_name !== undefined && j?.client_name !== null
                  ? String(j.client_name)
                  : null,
            };
          });
          setJobs(normalized);
        }
      }
      if (rawIdx) {
        const parsedIdx = parseInt(rawIdx, 10);
        if (!Number.isNaN(parsedIdx)) setIdx(parsedIdx);
      }
      if (rawTotal) {
        const parsedTotal = parseInt(rawTotal, 10);
        if (!Number.isNaN(parsedTotal)) setTotal(parsedTotal);
      }
    } catch (err) {
      console.error("Parse failed:", err);
    }
  }, [params]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGpsError("Geolocation is not supported by this device.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setGpsData({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          acc: position.coords.accuracy,
          time: new Date(position.timestamp).toISOString(),
        });
        setGpsError(null);
      },
      (error) => {
        console.warn("Geolocation error", error);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsError("Location permission denied. Proofs will save without GPS data.");
        } else {
          setGpsError("Unable to determine location. Proofs will save without GPS data.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => {
      if (typeof watchId === "number") navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const job = jobs[idx]; // current job

  if (!job) return <div className="p-6 text-white">No job found.</div>;

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
          className={`${color} px-3 py-1 rounded-full text-xs font-semibold`}
        >
          {bin.charAt(0).toUpperCase() + bin.slice(1)}
        </span>
      );
    });
  }

  function goToNextJob() {
    const nextIdx = idx + 1;

    if (total > 0 && nextIdx >= total) {
      alert("🎉 All jobs completed!");
      router.push("/staff/run");
    } else {
      router.push(
        `/staff/route?jobs=${encodeURIComponent(
          JSON.stringify(jobs)
        )}&nextIdx=${nextIdx}`
      );
    }
  }

  async function handleMarkDone() {
    if (!file) {
      alert("Please take a photo before marking the job done.");
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("You must be signed in to submit proof.");

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const safeTimestamp = now.toISOString().replace(/[:.]/g, "-");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${job.id}-${safeTimestamp}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("proofs")
        .upload(path, file, { upsert: false });
      if (uploadErr) throw uploadErr;

      const propertyNote = typeof job.notes === "string" ? job.notes.trim() : "";
      const staffNote = note.trim();
      const notesParts = [] as string[];
      if (propertyNote) notesParts.push(propertyNote);
      if (staffNote) notesParts.push(`Staff note: ${staffNote}`);
      const combinedNotes = notesParts.length ? notesParts.join("\n") : null;

      const { error: logErr } = await supabase.from("logs").insert({
        client_name: job.client_name ?? null,
        address: job.address,
        task_type: job.job_type,
        bins: job.bins ?? null,
        notes: combinedNotes,
        photo_path: path,
        done_on: dateStr,
        gps_lat: gpsData.lat ?? null,
        gps_lng: gpsData.lng ?? null,
        gps_acc: gpsData.acc ?? null,
        gps_time: gpsData.time ?? null,
        user_id: user.id,
      });
      if (logErr) throw logErr;

      setNote("");
      setFile(null);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      if (fileInputRef.current) fileInputRef.current.value = "";

      goToNextJob();
    } catch (err: any) {
      console.error("Error saving proof", err);
      alert(err?.message || "Unable to save proof. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-black text-white relative">
      <div className="flex-1 p-6 pb-32 space-y-4">
        <h1
          className={`text-2xl font-bold ${
            job.job_type === "bring_in" ? "text-red-500" : "text-white"
          }`}
        >
          {job.job_type === "put_out" ? "Put Bins Out" : "Bring Bins In"}
        </h1>

        <p className="text-lg font-semibold">{job.address}</p>

        {/* Instructions dropdown */}
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowInstructions((p) => !p)}
            className="w-full flex justify-between items-center px-4 py-3 font-semibold bg-white text-gray-900 hover:bg-gray-100 transition"
          >
            <span>Instructions</span>
            <span>{showInstructions ? "▲" : "▼"}</span>
          </button>

          {showInstructions && (
            <div className="p-4 space-y-4 bg-white text-gray-900">
              {/* Photos side by side */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-2">Bins Out:</p>
                  <img
                    src="/bins-out.jpg"
                    alt="Bins Out Example"
                    className="w-full aspect-[3/4] object-cover rounded-lg"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-2">Bins In:</p>
                  <img
                    src="/bins-in.jpg"
                    alt="Bins In Example"
                    className="w-full aspect-[3/4] object-cover rounded-lg"
                  />
                </div>
              </div>


              {/* Text instructions */}
              <div>
                <p className="text-sm text-gray-500 mb-2">
                  Placement Instructions:
                </p>
                <p>
                  Place bins neatly at the edge of the driveway with lids closed.
                  Ensure bins do not block pedestrian walkways or driveways.  
                  (This text will be customized per job later.)
                </p>
              </div>
            </div>
          )}
        </div>

        {job.notes && (
          <div>
            <p className="text-sm text-gray-400 mb-1">Property Notes:</p>
            <p className="text-white font-medium">{job.notes}</p>
          </div>
        )}

        {/* Bins */}
        <div>
          <p className="text-sm text-gray-400 mb-1">Bins:</p>
          <div className="flex flex-wrap gap-2">{renderBins(job.bins)}</div>
        </div>

        {/* Take photo */}
        <div className="flex flex-col gap-2">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            id="photo-upload"
            className="hidden"
            ref={fileInputRef}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setPreview((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return f ? URL.createObjectURL(f) : null;
              });
            }}
          />
          <label
            htmlFor="photo-upload"
            className="w-full cursor-pointer bg-white text-black px-4 py-2 rounded-lg text-center font-semibold"
          >
            {preview ? "Retake Photo ✓" : "Take Photo"}
          </label>
          {preview && (
            <div className="flex justify-center mt-2">
              <img
                src={preview}
                alt="preview"
                className="w-40 h-40 object-cover rounded-lg border border-gray-600"
              />
            </div>
          )}
        </div>

      {/* Leave note */}
      <div>
        <p className="text-sm text-gray-400 mb-1">Leave a note:</p>
        <textarea
          value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add any details..."
          className="w-full p-3 rounded-lg bg-white text-black min-h-[100px]"
        />
      </div>

      {gpsError && (
        <div className="text-sm text-red-400">
          <p>{gpsError}</p>
        </div>
      )}
    </div>

      {/* Mark Done pinned bottom */}
      <div className="absolute bottom-0 inset-x-0 p-4">
        <button
          onClick={handleMarkDone}
          disabled={!file || submitting}
          className="w-full bg-[#ff5757] text-black px-4 py-3 rounded-lg font-bold disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Mark Done"}
        </button>
      </div>
    </div>
  );
}
