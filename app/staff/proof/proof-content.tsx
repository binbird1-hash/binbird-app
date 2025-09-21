"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { getLocalISODate } from "@/lib/date";

type Job = {
  id: string;
  address: string;
  job_type: "put_out" | "bring_in";
  bins?: string | null;
  notes?: string | null;
  lat: number;
  lng: number;
  photo_path: string | null;
  client_name: string | null;
  last_completed_on?: string | null;
};

const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const PUT_OUT_PLACEHOLDER_URL =
  "https://via.placeholder.com/600x800?text=Put+Bins+Out";
const BRING_IN_PLACEHOLDER_URL =
  "https://via.placeholder.com/600x800?text=Bring+Bins+In";

async function prepareFileAsJpeg(
  originalFile: File,
  desiredName: string
): Promise<File> {
  const isAlreadyJpeg =
    originalFile.type === "image/jpeg" ||
    originalFile.type === "image/jpg" ||
    /\.jpe?g$/i.test(originalFile.name);

  if (isAlreadyJpeg) {
    if (originalFile.name === desiredName && originalFile.type === "image/jpeg") {
      return originalFile;
    }
    return new File([originalFile], desiredName, { type: "image/jpeg" });
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error ?? new Error("Unable to read the selected image file."));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(originalFile);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to process the selected image file."));
    image.src = dataUrl;
  });

  if (typeof img.decode === "function") {
    try {
      await img.decode();
    } catch {
      // ignore decode errors; drawImage fallback still works.
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to convert image to JPEG.");
  }
  ctx.drawImage(img, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to convert image to JPEG."));
      },
      "image/jpeg",
      0.92
    );
  });

  return new File([blob], desiredName, { type: "image/jpeg" });
}

export default function ProofPageContent() {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const params = useSearchParams();
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [idx, setIdx] = useState<number>(0);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [referenceUrls, setReferenceUrls] = useState<{
    putOut: string | null;
    bringIn: string | null;
  }>({ putOut: null, bringIn: null });
  const [referenceLookupComplete, setReferenceLookupComplete] = useState(false);

  const [gpsData, setGpsData] = useState<{
    lat: number | null;
    lng: number | null;
    acc: number | null;
    time: string | null;
  }>({ lat: null, lng: null, acc: null, time: null });
  const [gpsError, setGpsError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Parse jobs and idx
  useEffect(() => {
    try {
      const rawJobs = params.get("jobs");
      const rawIdx = params.get("idx");
      if (rawJobs) {
        const parsed = JSON.parse(rawJobs);
        if (Array.isArray(parsed)) {
          const normalized = parsed.map((j: any): Job => ({
            id: String(j?.id ?? ""),
            address: String(j?.address ?? ""),
            job_type: j?.job_type === "bring_in" ? "bring_in" : "put_out",
            bins: j?.bins ?? null,
            notes: j?.notes ?? null,
            lat: Number(j?.lat ?? 0),
            lng: Number(j?.lng ?? 0),
            client_name: j?.client_name ?? null,
            last_completed_on: j?.last_completed_on ?? null,
            photo_path:
              typeof j?.photo_path === "string" && j.photo_path.trim().length
                ? j.photo_path
                : null,
          }));
          setJobs(normalized);
        }
      }
      if (rawIdx) {
        const parsedIdx = parseInt(rawIdx, 10);
        if (!Number.isNaN(parsedIdx)) setIdx(parsedIdx);
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

  const currentIdx = Math.min(idx, Math.max(jobs.length - 1, 0));
  const job = jobs[currentIdx]; // current job

  useEffect(() => {
    let isCancelled = false;

    async function fetchReferenceImage(currentJob: Job | undefined) {
      if (!currentJob?.photo_path) {
        if (!isCancelled) {
          setReferenceUrls({ putOut: null, bringIn: null });
          setReferenceLookupComplete(true);
        }
        return;
      }

      const trimmedPath = currentJob.photo_path.trim();
      if (!trimmedPath) {
        if (!isCancelled) {
          setReferenceUrls({ putOut: null, bringIn: null });
          setReferenceLookupComplete(true);
        }
        return;
      }

      const sanitizedPath = trimmedPath
        .replace(/^\/+/, "")
        .replace(/\/+$/, "");

      if (!sanitizedPath) {
        if (!isCancelled) {
          setReferenceUrls({ putOut: null, bringIn: null });
          setReferenceLookupComplete(true);
        }
        return;
      }

      setReferenceLookupComplete(false);

      const hasFileExtension = /\.[^/]+$/.test(sanitizedPath);
      let baseDirectory: string | null = null;

      if (!hasFileExtension) {
        baseDirectory = sanitizedPath;
      } else {
        const lastSlashIndex = sanitizedPath.lastIndexOf("/");
        if (lastSlashIndex > -1) {
          const potentialBase = sanitizedPath.slice(0, lastSlashIndex);
          if (potentialBase) {
            baseDirectory = potentialBase;
          }
        }
      }

      let putOutPath: string | null = null;
      let bringInPath: string | null = null;

      if (baseDirectory) {
        putOutPath = `${baseDirectory}/Put Out.jpg`;
        bringInPath = `${baseDirectory}/Bring In.jpg`;
      }

      if (!putOutPath && hasFileExtension && sanitizedPath) {
        putOutPath = sanitizedPath;
      }

      if (!bringInPath && hasFileExtension && sanitizedPath) {
        bringInPath = sanitizedPath;
      }

      try {
        const bucket = supabase.storage.from("proofs");

        const loadSignedUrl = async (path: string | null) => {
          if (!path) return null;
          try {
            const { data, error } = await bucket.createSignedUrl(path, 60 * 60);
            if (error) {
              console.warn(`Unable to load reference image at ${path}:`, error);
              return null;
            }
            return data?.signedUrl ?? null;
          } catch (err) {
            console.warn(
              `Unexpected error loading reference image at ${path}:`,
              err
            );
            return null;
          }
        };

        const fallbackPath = hasFileExtension ? sanitizedPath : null;

        const [putOutUrl, bringInUrl] = await Promise.all([
          loadSignedUrl(putOutPath ?? fallbackPath),
          loadSignedUrl(bringInPath ?? fallbackPath),
        ]);

        if (!isCancelled) {
          setReferenceUrls({ putOut: putOutUrl, bringIn: bringInUrl });
        }
      } catch (err) {
        if (!isCancelled) {
          console.warn("Failed to load reference images:", err);
          setReferenceUrls({ putOut: null, bringIn: null });
        }
      } finally {
        if (!isCancelled) {
          setReferenceLookupComplete(true);
        }
      }
    }

    fetchReferenceImage(job);

    return () => {
      isCancelled = true;
    };
  }, [job, supabase]);

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

  function goToNextJob(remainingJobs: Job[]) {
    if (!remainingJobs.length) {
      alert("🎉 All jobs completed!");
      router.push("/staff/run");
      return;
    }

    const nextIdx = Math.min(currentIdx, Math.max(remainingJobs.length - 1, 0));

    router.push(
      `/staff/route?jobs=${encodeURIComponent(
        JSON.stringify(remainingJobs)
      )}&nextIdx=${nextIdx}&total=${remainingJobs.length}`
    );
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
      const dateStr = getLocalISODate(now);
      const safeTimestamp = now.toISOString().replace(/[:.]/g, "-");
      const fileLabel = job.job_type === "bring_in" ? "bring-in" : "put-out";
      const finalFileName = `${fileLabel}-${safeTimestamp}.jpg`;
      const uploadFile = await prepareFileAsJpeg(file, finalFileName);
      const path = `${job.id}/${finalFileName}`;

      const { error: uploadErr } = await supabase.storage
        .from("proofs")
        .upload(path, uploadFile, { upsert: true });
      if (uploadErr) throw uploadErr;

      const staffNote = note.trim();
      const noteValue = staffNote.length ? staffNote : null;

      const { error: logErr } = await supabase.from("logs").insert({
        job_id: job.id,
        client_name: job.client_name ?? null,
        address: job.address,
        task_type: job.job_type,
        bins: job.bins ?? null,
        notes: noteValue,
        photo_path: path,
        done_on: dateStr,
        gps_lat: gpsData.lat ?? null,
        gps_lng: gpsData.lng ?? null,
        gps_acc: gpsData.acc ?? null,
        gps_time: gpsData.time ?? null,
        user_id: user.id,
      });
      if (logErr) throw logErr;

      const { error: updateErr } = await supabase
        .from("jobs")
        .update({ last_completed_on: dateStr })
        .eq("id", job.id);
      if (updateErr) throw updateErr;

      setNote("");
      setFile(null);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      if (fileInputRef.current) fileInputRef.current.value = "";

      const remainingJobs = jobs.filter((j) => j.id !== job.id);
      goToNextJob(remainingJobs);
    } catch (err: any) {
      console.error("Error saving proof", err);
      alert(err?.message || "Unable to save proof. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const putOutImageSrc = referenceLookupComplete
    ? referenceUrls.putOut ?? PUT_OUT_PLACEHOLDER_URL
    : TRANSPARENT_PIXEL;
  const bringInImageSrc = referenceLookupComplete
    ? referenceUrls.bringIn ?? BRING_IN_PLACEHOLDER_URL
    : TRANSPARENT_PIXEL;

  return (
    <div className="flex flex-col min-h-screen bg-black text-white relative">
      <div className="flex-1 p-6 pb-32 space-y-4">
        <h1 className="text-2xl font-bold text-[#ff5757]">
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
                    src={putOutImageSrc}
                    alt="Bins Out Example"
                    className="w-full aspect-[3/4] object-cover rounded-lg"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-2">Bins In:</p>
                  <img
                    src={bringInImageSrc}
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
