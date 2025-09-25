"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { getLocalISODate } from "@/lib/date";
import { normalizeJobs, type Job } from "@/lib/jobs";
import { readRunSession, writeRunSession, type RunSessionRecord } from "@/lib/run-session";
import { clearPlannedRun } from "@/lib/planned-run";

const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const PUT_OUT_PLACEHOLDER_URL =
  "https://via.placeholder.com/600x800?text=Put+Bins+Out";
const BRING_IN_PLACEHOLDER_URL =
  "https://via.placeholder.com/600x800?text=Bring+Bins+In";

// 🟢 Helper: turn text into kebab-case (handles commas)
function toKebab(value: string | null | undefined, fallback: string): string {
  if (!value || typeof value !== "string") return fallback;

  return value
    .toLowerCase()
    .replace(/,\s*/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// 🟢 Helper: Month-Year and Week
function getMonthAndWeek(date: Date) {
  const month = date.toLocaleString("en-US", { month: "long" });
  const year = date.getFullYear();
  const monthYear = `${month}, ${year}`;
  const day = date.getDate();
  const week = `Week ${Math.ceil(day / 7)}`;
  return { monthYear, week };
}

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
    } catch {}
  }

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to convert image to JPEG.");
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
          setJobs(normalizeJobs(parsed));
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

  const getActiveRunSession = useCallback(() => {
    const existing = readRunSession();
    if (!existing) return null;
    if (existing.endedAt) {
      const endDate = new Date(existing.endedAt);
      if (!Number.isNaN(endDate.getTime())) {
        return null;
      }
    }
    return existing;
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function fetchReferenceImages() {
      if (!job?.photo_path) {
        console.log("No photo_path found for job:", job);
        return;
      }

      const basePath = job.photo_path;
      const bucket = supabase.storage.from("proofs");

      const [putOutRes, bringInRes] = await Promise.all([
        bucket.createSignedUrl(`${basePath}/Put Out.jpg`, 3600),
        bucket.createSignedUrl(`${basePath}/Bring In.jpg`, 3600),
      ]);

      if (!isCancelled) {
        setReferenceUrls({
          putOut: putOutRes.data?.signedUrl ?? null,
          bringIn: bringInRes.data?.signedUrl ?? null,
        });
        setReferenceLookupComplete(true);
      }
    }

    fetchReferenceImages();

    return () => {
      isCancelled = true;
    };
  }, [jobs, idx, supabase]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!jobs.length) return;

    const activeSession = getActiveRunSession();
    const totalJobs = Math.max(activeSession?.totalJobs ?? 0, jobs.length);
    const safeIdx = Number.isFinite(idx) ? idx : 0;
    const completedFromIdx = Math.min(Math.max(safeIdx, 0), totalJobs);
    const startedAt =
      activeSession?.startedAt && !Number.isNaN(new Date(activeSession.startedAt).getTime())
        ? activeSession.startedAt
        : new Date().toISOString();

    writeRunSession({
      startedAt,
      endedAt: null,
      totalJobs,
      completedJobs: Math.max(activeSession?.completedJobs ?? 0, completedFromIdx),
    });
  }, [jobs.length, idx, getActiveRunSession]);

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
  const job = jobs[currentIdx];

  if (!job) {
    return <div className="p-6 text-white">No job found.</div>;
  }

  function getParsedBins(bins: string | null | undefined) {
    if (!bins) return [] as string[];
    return bins
      .split(",")
      .map((bin) => bin.trim())
      .filter(Boolean);
  }

  const parsedBins = getParsedBins(job.bins);

  function getBinColorClasses(bin: string) {
    const normalized = bin.toLowerCase();
    if (normalized.includes("red")) return "bg-red-600 text-white";
    if (normalized.includes("yellow")) return "bg-yellow-400 text-black";
    if (normalized.includes("green")) return "bg-green-600 text-white";
    return "bg-gray-600 text-white";
  }

  function getBinLabel(bin: string) {
    const upper = bin.toUpperCase();
    return upper.includes("BIN") ? upper : `${upper} BIN`;
  }

  function renderBinCards(prefix: string) {
    if (!parsedBins.length) return null;
    return parsedBins.map((bin, idx) => (
      <div
        key={`${prefix}-${bin.toLowerCase()}-${idx}`}
        className={`w-full py-3 rounded-lg text-center font-bold text-lg shadow-md uppercase ${getBinColorClasses(
          bin
        )}`}
      >
        {getBinLabel(bin)}
      </div>
    ));
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
      const { monthYear, week } = getMonthAndWeek(now);
  
      const safeClient = toKebab(job.client_name, "unknown-client");
      const safeAddress = toKebab(job.address, "unknown-address");
  
      const folderPath = `${safeClient}/${safeAddress}/${monthYear}/${week}`;
      const fileLabel = job.job_type === "bring_in" ? "Bring In.jpg" : "Put Out.jpg";
  
      const uploadFile = await prepareFileAsJpeg(file, fileLabel);
      const path = `${folderPath}/${fileLabel}`;
  
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
  
      await supabase.from("jobs").update({ last_completed_on: dateStr }).eq("id", job.id);
  
      // cleanup state
      setNote("");
      setFile(null);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
  
      const nextIdx = idx + 1;

      const existingSession = getActiveRunSession();
      const nowIso = new Date().toISOString();
      const totalJobs = Math.max(existingSession?.totalJobs ?? 0, jobs.length, nextIdx);
      const completedAfterThisJob = Math.min(nextIdx, totalJobs);

      const startedAt =
        existingSession?.startedAt &&
        !Number.isNaN(new Date(existingSession.startedAt).getTime())
          ? existingSession.startedAt
          : nowIso;

      const updatedSession: RunSessionRecord = {
        ...(existingSession ?? {}),
        startedAt,
        endedAt: null,
        totalJobs,
        completedJobs: Math.max(existingSession?.completedJobs ?? 0, completedAfterThisJob),
      };

      const sessionToWrite: RunSessionRecord =
        nextIdx >= jobs.length
          ? { ...updatedSession, endedAt: nowIso }
          : updatedSession;

      writeRunSession(sessionToWrite);

      // 👉 Decide where to navigate
      if (nextIdx >= jobs.length) {
        // all jobs done
        clearPlannedRun();
        router.push("/staff/run/completed");
      } else {
        // go to route page for the next job
        const paramsObj = new URLSearchParams({
          jobs: JSON.stringify(jobs),
          nextIdx: String(nextIdx),
          total: String(jobs.length),
        });
        router.push(`/staff/route?${paramsObj.toString()}`);
      }
    } catch (err: any) {
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
  const isPutOutJob = job.job_type === "put_out";
  const startImageSrc = isPutOutJob ? bringInImageSrc : putOutImageSrc;
  const endImageSrc = isPutOutJob ? putOutImageSrc : bringInImageSrc;
  const startLocationLabel = isPutOutJob ? "Storage Area" : "Kerb";
  const endLocationLabel = isPutOutJob ? "Kerb" : "Storage Area";
  const startBodyCopy = isPutOutJob
    ? {
        primary: "Go to the storage area to find the bins.",
        secondary: "If no bins are there, skip to Step 4.",
      }
    : {
        primary: "Go to the kerb to find the bins waiting.",
        secondary: "If no bins are there, skip to Step 4.",
      };
  const endBodyCopy = isPutOutJob
    ? {
        primary: "Park bins neatly on the kerb for collection.",
        secondary: "Line them up exactly like this photo.",
      }
    : {
        primary: "Park bins neatly in the storage area.",
        secondary: "Line them up exactly like this photo.",
      };
  const moveFinalLine = isPutOutJob
    ? "Leave the storage area empty when you’re done."
    : "Leave the kerb empty when you’re done.";
  const finalCheckLines = isPutOutJob
    ? [
        "✅ Lids down tight.",
        "✅ Bins lined up neatly at the kerb.",
        "✅ Paths, doors, and kerbs clear.",
      ]
    : [
        "✅ Lids down tight.",
        "✅ Bins lined up neatly.",
        "✅ Paths, doors, and kerbs clear.",
      ];
  const hasPhoto = Boolean(file);
  const readyToSubmit = hasPhoto;
  const binCardsForInstructions = renderBinCards("instructions");

  return (
    <div className="relative flex min-h-full flex-col bg-gradient-to-br from-neutral-950 via-neutral-900 to-black text-white">
      <div className="flex-1 p-6 pb-32 space-y-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#ff5757] drop-shadow-[0_6px_18px_rgba(255,87,87,0.35)]">
          {job.job_type === "put_out" ? "Put Bins Out" : "Bring Bins In"}
        </h1>

        <p className="text-lg font-semibold text-gray-200">{job.address}</p>

        <section className="space-y-4 rounded-2xl border border-neutral-800/70 bg-neutral-950/70 p-4 shadow-[0_25px_50px_rgba(0,0,0,0.45)] backdrop-blur">
          <details className="border border-gray-800/80 rounded-xl mb-3 overflow-hidden bg-neutral-900/60">
            <summary className="px-4 py-3 font-bold bg-neutral-900/80 cursor-pointer">
              Step 1 – Start Spot
            </summary>
            <div className="p-4 bg-neutral-900/60 space-y-3 text-left">
              <p className="text-sm font-semibold text-gray-100">
                <span aria-hidden className="mr-1">📷</span>
                {startLocationLabel} (START HERE)
              </p>
              <div className="relative">
                <img
                  src={startImageSrc}
                  alt={`${startLocationLabel} example`}
                  className="w-full aspect-[3/4] object-cover rounded-lg"
                />
                <span className="absolute top-3 left-3 rounded-full bg-[#ff5757] px-3 py-1 text-xs font-semibold uppercase tracking-wide shadow-lg">
                  START HERE
                </span>
                <span className="absolute bottom-3 left-3 rounded bg-black/70 px-3 py-1 text-xs uppercase tracking-wide">
                  {startLocationLabel}
                </span>
              </div>
              <p className="text-sm text-gray-200 font-semibold">{startBodyCopy.primary}</p>
              <p className="text-sm text-gray-300">{startBodyCopy.secondary}</p>
            </div>
          </details>

          <details className="border border-gray-800/80 rounded-xl mb-3 overflow-hidden bg-neutral-900/60">
            <summary className="px-4 py-3 font-bold bg-neutral-900/80 cursor-pointer">
              Step 2 – Today’s Bins
            </summary>
            <div className="p-4 bg-neutral-900/60 space-y-3 text-left">
              {binCardsForInstructions ? (
                <div className="flex flex-col gap-3">{binCardsForInstructions}</div>
              ) : (
                <div className="w-full py-3 rounded-lg text-center font-bold text-lg shadow-md uppercase bg-neutral-700 text-white">
                  All Bins
                </div>
              )}
              <p className="text-sm text-gray-200 font-semibold whitespace-pre-line">
                {"Roll every bin in the colours shown above.\nNot sure? Take every bin."}
              </p>
            </div>
          </details>

          <details className="border border-gray-800/80 rounded-xl mb-3 overflow-hidden bg-neutral-900/60">
            <summary className="px-4 py-3 font-bold bg-neutral-900/80 cursor-pointer">
              Step 3 – Move the Bins
            </summary>
            <div className="p-4 bg-neutral-900/60 space-y-3 text-left">
              <div className="text-4xl text-center" aria-hidden>
                ➡️
              </div>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-300">
                <li>Take full bins too — don’t skip any.</li>
                <li>Keep driveways, doors, and kerbs clear.</li>
                <li>{moveFinalLine}</li>
              </ul>
            </div>
          </details>

          <details className="border border-gray-800/80 rounded-xl mb-3 overflow-hidden bg-neutral-900/60">
            <summary className="px-4 py-3 font-bold bg-neutral-900/80 cursor-pointer">
              Step 4 – Finish Spot
            </summary>
            <div className="p-4 bg-neutral-900/60 space-y-3 text-left">
              <p className="text-sm font-semibold text-gray-100">
                <span aria-hidden className="mr-1">📷</span>
                {endLocationLabel} (END HERE)
              </p>
              <div className="relative">
                <img
                  src={endImageSrc}
                  alt={`${endLocationLabel} example`}
                  className="w-full aspect-[3/4] object-cover rounded-lg"
                />
                <span className="absolute top-3 left-3 rounded-full bg-green-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide shadow-lg">
                  END HERE
                </span>
                <span className="absolute bottom-3 left-3 rounded bg-black/70 px-3 py-1 text-xs uppercase tracking-wide">
                  {endLocationLabel}
                </span>
              </div>
              <p className="text-sm text-gray-200 font-semibold">{endBodyCopy.primary}</p>
              <p className="text-sm text-gray-300">{endBodyCopy.secondary}</p>
            </div>
          </details>

          <details className="border border-gray-800/80 rounded-xl mb-3 overflow-hidden bg-neutral-900/60">
            <summary className="px-4 py-3 font-bold bg-neutral-900/80 cursor-pointer">
              Step 5 – Final Check
            </summary>
            <div className="p-4 bg-neutral-900/60 text-left">
              <ul className="list-disc list-inside text-white space-y-2 text-sm">
                {finalCheckLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </details>
        </section>

        {job.notes && (
          <div className="bg-neutral-900/80 border border-neutral-800/70 rounded-xl p-4 shadow-lg">
            <p className="text-sm text-gray-400 mb-1">Property Notes:</p>
            <p className="text-white font-medium">{job.notes}</p>
          </div>
        )}

        {/* Take photo */}
        <div className="flex flex-col gap-3 mt-10">
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
          {preview && (
            <div className="flex flex-col items-center gap-2">
              <img
                src={preview}
                alt="preview"
                className="w-full aspect-[3/4] object-cover rounded-xl border border-neutral-800/70 shadow-[0_15px_35px_rgba(0,0,0,0.45)]"
                onClick={() => fileInputRef.current?.click()}
              />
              {!submitting && (
                <button
                  type="button"
                  className="text-sm text-gray-300 underline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Need a new photo?
                </button>
              )}
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
            className="w-full p-3 rounded-lg bg-neutral-900 text-white min-h-[100px] placeholder-gray-500"
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
          onClick={() => {
            if (submitting) return;
            if (!file) {
              fileInputRef.current?.click();
              return;
            }
            void handleMarkDone();
          }}
          disabled={submitting}
          className={`w-full px-4 py-3 rounded-lg font-bold transition shadow-lg border ${
            readyToSubmit
              ? "bg-[#ff5757] text-white hover:opacity-90 border-[#ff7575]/60"
              : "bg-neutral-800 text-white hover:bg-neutral-700 border-white/10"
          } ${submitting ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          {submitting ? "Saving…" : readyToSubmit ? "Mark Done" : "Take Photo"}
        </button>
      </div>
    </div>
  );
}
