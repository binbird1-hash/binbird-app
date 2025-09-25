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
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 py-16">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/70 px-6 py-5 text-center text-sm font-medium text-white/80 shadow-2xl shadow-black/40 backdrop-blur">
          No job found.
        </div>
      </div>
    );
  }

  function renderBins(bins: string | null | undefined) {
    if (!bins)
      return (
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/50">—</span>
      );
    return bins.split(",").map((b) => {
      const bin = b.trim().toLowerCase();
      let color = "bg-white/15 text-white";
      if (bin.includes("red")) color = "bg-red-500/80 text-white";
      else if (bin.includes("yellow")) color = "bg-yellow-400/90 text-black";
      else if (bin.includes("green")) color = "bg-emerald-500/80 text-white";
      return (
        <span
          key={bin}
          className={`${color} rounded-full px-3 py-1 text-xs font-semibold shadow-sm shadow-black/30`}
        >
          {bin.charAt(0).toUpperCase() + bin.slice(1)}
        </span>
      );
    });
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

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-6 px-4 pb-32 pt-10 text-white">
      <section className="rounded-3xl border border-white/10 bg-black/75 p-6 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/50">Job type</p>
            <h1 className="mt-1 text-3xl font-semibold text-white">
              {job.job_type === "put_out" ? "Put bins out" : "Bring bins in"}
            </h1>
            <p className="text-sm text-white/60">{job.address}</p>
          </div>

          <button
            onClick={() => setShowInstructions((p) => !p)}
            className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-binbird-red hover:bg-white/10"
          >
            <span>Reference guidance</span>
            <span className="text-xs uppercase tracking-[0.25em] text-white/60">
              {showInstructions ? "Hide" : "View"}
            </span>
          </button>

          {showInstructions && (
            <div className="grid gap-4 rounded-2xl border border-white/10 bg-black/60 p-4 text-sm text-white/70 shadow-inner shadow-black/40">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">Bins out</p>
                  <img
                    src={putOutImageSrc}
                    alt="Bins out example"
                    className="aspect-[3/4] w-full rounded-2xl border border-white/10 object-cover"
                  />
                </div>
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">Bins in</p>
                  <img
                    src={bringInImageSrc}
                    alt="Bins in example"
                    className="aspect-[3/4] w-full rounded-2xl border border-white/10 object-cover"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Placement instructions</p>
                <p className="mt-2 text-sm text-white/60">
                  {job.job_type === "bring_in"
                    ? "Return bins neatly to their storage location. Ensure lids are closed and bins are not left blocking walkways or driveways."
                    : "Place bins neatly at the edge of the driveway with lids closed. Ensure bins do not block pedestrian walkways or driveways."}
                </p>
              </div>
            </div>
          )}

          {job.notes && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Property notes</p>
              <p className="mt-2 text-sm text-white/60">{job.notes}</p>
            </div>
          )}

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Bins</p>
            <div className="mt-2 flex flex-wrap gap-2">{renderBins(job.bins)}</div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-black/75 p-6 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="flex flex-col gap-4">
          <p className="text-xs uppercase tracking-[0.35em] text-white/50">Proof capture</p>

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
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:border-binbird-red hover:bg-white/20"
          >
            {preview ? "Retake photo" : "Take photo"}
            {preview && <span className="text-xs uppercase tracking-[0.3em] text-white/60">✓</span>}
          </label>

          {preview && (
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <img
                src={preview}
                alt="preview"
                className="aspect-[3/4] w-full object-cover"
              />
            </div>
          )}

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Leave a note</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any helpful details for the client…"
              className="mt-2 w-full min-h-[140px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/50 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/40"
            />
          </div>

          {gpsError && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {gpsError}
            </div>
          )}
        </div>
      </section>

      <div className="sticky bottom-8 z-20">
        <button
          onClick={handleMarkDone}
          disabled={!file || submitting}
          className="w-full rounded-3xl bg-binbird-red px-6 py-4 text-base font-semibold text-white shadow-2xl shadow-red-900/40 transition hover:bg-[#ff4747] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Mark done"}
        </button>
      </div>
    </div>
  );
}
