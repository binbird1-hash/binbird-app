"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { getOperationalISODate } from "@/lib/date";
import { normalizeJobs, type Job } from "@/lib/jobs";
import { readRunSession, writeRunSession, type RunSessionRecord } from "@/lib/run-session";
import { clearPlannedRun, readPlannedRun, writePlannedRun } from "@/lib/planned-run";

const PUT_OUT_PLACEHOLDER_URL =
  "https://via.placeholder.com/600x800?text=Put+Bins+Out";
const BRING_IN_PLACEHOLDER_URL =
  "https://via.placeholder.com/600x800?text=Bring+Bins+In";

// kebab-case helper
function toKebab(value: string | null | undefined, fallback: string): string {
  if (!value || typeof value !== "string") return fallback;
  return value
    .toLowerCase()
    .replace(/,\s*/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateSequentialFileName(
  baseName: string,
  extension: string,
  existingNames: string[]
): string {
  const existing = new Set(existingNames);
  const defaultLabel = `${baseName}${extension}`;
  if (!existing.has(defaultLabel)) return defaultLabel;

  let counter = 2;
  while (existing.has(`${baseName} (${counter})${extension}`)) {
    counter += 1;
  }
  return `${baseName} (${counter})${extension}`;
}

// custom week helper (Monday-Saturday cycle, Sunday joins next week)
function getCustomWeek(date: Date) {
  const d = new Date(date);

  // If Sunday, push to Monday (next cycle)
  if (d.getDay() === 0) {
    d.setDate(d.getDate() + 1);
  }

  // ISO week calc
  const target = new Date(d.valueOf());
  const dayNr = (target.getDay() + 6) % 7; // Monday=0 … Sunday=6
  target.setDate(target.getDate() - dayNr + 3); // Thursday of current week
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.valueOf() - firstThursday.valueOf();
  const week = 1 + Math.round(diff / (7 * 24 * 3600 * 1000));

  return {
    year: target.getFullYear(),
    week: `Week-${week}`,
  };
}

async function prepareFileAsJpeg(originalFile: File, desiredName: string): Promise<File> {
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
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file."));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(originalFile);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to process image."));
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
      (b) => (b ? resolve(b) : reject(new Error("Failed to convert image to JPEG."))),
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
  const [referenceUrls, setReferenceUrls] = useState<{ putOut: string | null; bringIn: string | null }>({
    putOut: null,
    bringIn: null,
  });
  const [referenceLookupComplete, setReferenceLookupComplete] = useState(false);

  const [gpsData, setGpsData] = useState<{ lat: number | null; lng: number | null; acc: number | null; time: string | null; }>({ lat: null, lng: null, acc: null, time: null });
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [checklist, setChecklist] = useState({
    propertyConfirmed: false,
    binColoursConfirmed: false,
    placementUnderstood: false,
    neatnessConfirmed: false,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // parse jobs + idx from params
  useEffect(() => {
    try {
      const rawJobs = params.get("jobs");
      const rawIdx = params.get("idx");
      if (rawJobs) {
        const parsed = JSON.parse(rawJobs);
        if (Array.isArray(parsed)) setJobs(normalizeJobs(parsed));
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
      if (!Number.isNaN(endDate.getTime())) return null;
    }
    return existing;
  }, []);

  useEffect(() => {
    const activeSession = getActiveRunSession();
    if (!activeSession) {
      const planned = readPlannedRun();
      if (!planned) {
        router.replace("/staff/run");
      }
    }
  }, [getActiveRunSession, router]);

  useEffect(() => {
    let isCancelled = false;
    async function fetchReferenceImages() {
      if (!job?.photo_path) return;
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

  // geolocation watcher
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGpsError("Geolocation is not supported by this device.");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsData({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: pos.coords.accuracy,
          time: new Date(pos.timestamp).toISOString(),
        });
        setGpsError(null);
      },
      (error) => {
        setGpsError(
          error.code === error.PERMISSION_DENIED
            ? "Location permission denied. Proofs will save without GPS data."
            : "Unable to determine location. Proofs will save without GPS data."
        );
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
  if (!job) return <div className="p-6 text-white">No job found.</div>;

  // bins helpers
  function getParsedBins(bins: string | null | undefined) {
    if (!bins) return [] as string[];
    return bins.split(",").map((b) => b.trim()).filter(Boolean);
  }
  const parsedBins = getParsedBins(job.bins);

  function getBinColorStyles(bin: string) {
    const normalized = bin.toLowerCase();
    if (normalized.includes("red")) return { background: "bg-red-600", border: "border-red-500/70", text: "text-white" };
    if (normalized.includes("yellow")) return { background: "bg-amber-300", border: "border-amber-300/70", text: "text-black" };
    if (normalized.includes("green")) return { background: "bg-emerald-600", border: "border-emerald-500/70", text: "text-white" };
    return { background: "bg-neutral-800", border: "border-neutral-600/70", text: "text-white" };
  }
  function getBinLabel(bin: string) {
    const normalized = bin.toLowerCase();
    if (normalized.includes("red")) return "All Red Bins";
    if (normalized.includes("yellow")) return "All Yellow Bins";
    if (normalized.includes("green")) return "All Green Bins";
    const cleaned = bin.replace(/bins?/gi, "").trim();
    if (!cleaned) return "All Bins";
    const titleCase = cleaned.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    return `All ${titleCase} Bins`;
  }
  function renderBinCards(prefix: "instructions" | "quick-reference") {
    if (!parsedBins.length) return null;
    return parsedBins.map((bin, idx) => {
      const styles = getBinColorStyles(bin);
      return (
        <div
          key={`${prefix}-${bin}-${idx}`}
          className={`w-full rounded-xl border px-4 py-2 text-center text-base font-bold ${styles.border} ${styles.background}`}
        >
          <span className={`block font-bold ${styles.text}`}>{getBinLabel(bin)}</span>
        </div>
      );
    });
  }

  // handle submit
  async function handleMarkDone() {
    if (!file) {
      alert("Please take a photo before marking the job done.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("You must be signed in to submit proof.");
      const now = new Date();
      const dateStr = getOperationalISODate({ now });
      const { year, week } = getCustomWeek(now);
      const safeClient = toKebab(job.client_name, "unknown-client");
      const safeAddress = toKebab(job.address, "unknown-address");
      const folderPath = `${safeClient}/${safeAddress}/${year}/${week}`;
      const baseFileName = job.job_type === "bring_in" ? "Bring In" : "Put Out";
      const fileExtension = ".jpg";
      const { data: existingFiles, error: listErr } = await supabase.storage
        .from("proofs")
        .list(folderPath, { limit: 100 });
      if (listErr) {
        console.warn("Unable to check existing proof photos", listErr);
      }
      const fileLabel = generateSequentialFileName(
        baseFileName,
        fileExtension,
        existingFiles?.map((file) => file.name) ?? []
      );
      const uploadFile = await prepareFileAsJpeg(file, fileLabel);
      const path = `${folderPath}/${fileLabel}`;
      const { error: uploadErr } = await supabase.storage
        .from("proofs")
        .upload(path, uploadFile, { upsert: false });
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
      const nextIdx = idx + 1;
      const existingSession = getActiveRunSession();
      const nowIso = new Date().toISOString();
      const totalJobs = Math.max(existingSession?.totalJobs ?? 0, jobs.length, nextIdx);
      const completedAfterThisJob = Math.min(nextIdx, totalJobs);
      const startedAt =
        existingSession?.startedAt && !Number.isNaN(new Date(existingSession.startedAt).getTime())
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
        nextIdx >= jobs.length ? { ...updatedSession, endedAt: nowIso } : updatedSession;
      writeRunSession(sessionToWrite);
      if (nextIdx >= jobs.length) {
        clearPlannedRun();
        router.push("/staff/run/completed");
      } else {
        const existingPlan = readPlannedRun();
        if (existingPlan) {
          writePlannedRun({
            ...existingPlan,
            jobs: jobs.map((plannedJob) => ({ ...plannedJob })),
            nextIdx,
            hasStarted: true,
          });
        }
        const paramsObj = new URLSearchParams({
          jobs: JSON.stringify(jobs),
          nextIdx: String(nextIdx),
          total: String(jobs.length),
        });
        router.push(`/staff/route?${paramsObj.toString()}`);
      }
    } catch (err: any) {
      setSubmitting(false);
      alert(err?.message || "Unable to save proof. Please try again.");
    }
  }

  // images & copy
  const putOutImageSrc =
    referenceLookupComplete && referenceUrls.putOut
      ? referenceUrls.putOut
      : PUT_OUT_PLACEHOLDER_URL;
  const bringInImageSrc =
    referenceLookupComplete && referenceUrls.bringIn
      ? referenceUrls.bringIn
      : BRING_IN_PLACEHOLDER_URL;
  const isPutOutJob = job.job_type === "put_out";
  const endImageSrc = isPutOutJob ? putOutImageSrc : bringInImageSrc;
  const endLocationLabel = isPutOutJob ? "Kerb" : "Storage Area";
  const propertyReferenceImageSrc = isPutOutJob ? bringInImageSrc : putOutImageSrc;
  const propertyReferenceLabel = isPutOutJob ? "Check property" : "Put Out reference";
  const propertyReferenceAlt = isPutOutJob ? "Property reference" : "Put Out property reference";
  const finalPlacementImageSrc = isPutOutJob ? endImageSrc : bringInImageSrc;
  const finalPlacementLabel = isPutOutJob ? "Final placement" : "Bring In reference";
  const finalPlacementAlt = isPutOutJob ? `${endLocationLabel} reference` : "Bring In reference";

  const moveStepLines = isPutOutJob
    ? [
        "Roll every scheduled bin from the storage area to the kerb.",
        "Leave the storage area empty when you finish.",
        "Keep paths, doors, and kerbs clear while you move.",
      ]
    : [
        "Roll every scheduled bin from the kerb back inside.",
        "Leave the kerb clear when you finish.",
        "Keep paths, doors, and kerbs clear while you move.",
      ];
  const neatnessChecklist = isPutOutJob
    ? [
        "Bins are on the kerb in a straight line with space between each one.",
        "There is clear room for the truck to collect and nothing blocks the road or footpath.",
        "Lids are closed tight and the area is tidy.",
      ]
    : [
        "Bins are parked neatly in the storage area with space to access each bin.",
        "Doors, paths, and emergency exits are clear for the truck or building users.",
        "Lids are closed tight and the area is tidy.",
      ];

  const allChecklistChecked = Object.values(checklist).every(Boolean);
  const hasPhoto = Boolean(file);
  const readyToSubmit = hasPhoto && allChecklistChecked;
  const binCardsForInstructions = renderBinCards("instructions");
  const instructionsFallbackCard = (
    <div className="w-full rounded-xl border border-neutral-700 bg-neutral-800 px-4 py-3 text-center text-base font-semibold uppercase text-white">
      All Bins
    </div>
  );

  const handleChecklistChange = (key: keyof typeof checklist) => (event: ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target;
    setChecklist((prev) => ({ ...prev, [key]: checked }));
  };

  const checklistTickClass = isPutOutJob
    ? "mt-0.5 text-[#ff5757]"
    : "mt-0.5 text-[#ff5757] text-lg leading-none font-semibold";

  const checklistContainer = (
    <section className="space-y-5 rounded-2xl border border-neutral-800/70 bg-neutral-950/70 p-4 shadow-[0_25px_50px_rgba(0,0,0,0.45)] backdrop-blur">
      <h2 className="text-lg font-bold text-white">Follow these steps before you take a photo</h2>
      <div className="space-y-3">
        <div className="rounded-2xl border border-neutral-800/60 bg-neutral-950/80 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-gray-200">
              <p className="font-semibold text-white">
                {isPutOutJob ? "Confirm the property" : "Confirm the property & spacing"}
              </p>
              <p className="text-gray-400">
                {isPutOutJob ? (
                  <>I am at {job.address}.</>
                ) : (
                  <>I am at {job.address} and the bins are spaced like this when they are out.</>
                )}
              </p>
            </div>
            <input
              type="checkbox"
              className="h-5 w-5 rounded border border-neutral-600 bg-neutral-900 accent-[#ff5757]"
              checked={checklist.propertyConfirmed}
              onChange={handleChecklistChange("propertyConfirmed")}
            />
          </div>
          <div
            className={`grid transition-all duration-500 ease-in-out ${
              checklist.propertyConfirmed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
            }`}
          >
            <div className="overflow-hidden pt-4">
              <div className="space-y-3">
                <div>
                  <img
                    src={propertyReferenceImageSrc}
                    alt={propertyReferenceAlt}
                    className="w-full aspect-[3/4] object-cover rounded-xl border border-neutral-800/70"
                  />
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-300">
                    {propertyReferenceLabel}
                  </p>
                </div>
                {!isPutOutJob && (
                  <p className="text-xs text-gray-400">
                    Match the kerbside spacing shown here when bins are placed out before collection.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800/60 bg-neutral-950/80 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-gray-200">
              <p className="font-semibold text-white">Confirm the bin colours</p>
              <p className="text-gray-400">{isPutOutJob ? "Put out" : "Bring in"} every bin shown below.</p>
            </div>
            <input
              type="checkbox"
              className="h-5 w-5 rounded border border-neutral-600 bg-neutral-900 accent-[#ff5757]"
              checked={checklist.binColoursConfirmed}
              onChange={handleChecklistChange("binColoursConfirmed")}
            />
          </div>
          <div
            className={`grid transition-all duration-500 ease-in-out ${
              checklist.binColoursConfirmed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
            }`}
          >
            <div className="overflow-hidden pt-4">
              <div className="flex flex-col gap-2">{binCardsForInstructions ?? instructionsFallbackCard}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800/60 bg-neutral-950/80 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-gray-200">
              <p className="font-semibold text-white">
                {isPutOutJob ? "Stage the bins like this" : "Stage the bins correctly"}
              </p>
              <p className="text-gray-400">
                {isPutOutJob
                  ? "Match the spacing shown below when you move the bins."
                  : "Follow these steps when you move the bins back in."}
              </p>
            </div>
            <input
              type="checkbox"
              className="h-5 w-5 rounded border border-neutral-600 bg-neutral-900 accent-[#ff5757]"
              checked={checklist.placementUnderstood}
              onChange={handleChecklistChange("placementUnderstood")}
            />
          </div>
          <div
            className={`grid transition-all duration-500 ease-in-out ${
              checklist.placementUnderstood ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
            }`}
          >
            <div className="overflow-hidden pt-4 space-y-4">
              {isPutOutJob && (
                <div className="rounded-xl border border-neutral-800/70 bg-neutral-900/60 p-3">
                  <img
                    src="/images/binPlacement.png"
                    alt="Example spacing for bins"
                    className="w-full h-auto rounded-lg object-contain"
                  />
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-300">
                    Keep this spacing
                  </p>
                </div>
              )}
              <ul className="space-y-2 text-sm text-gray-300">
                {moveStepLines.map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span aria-hidden="true" className={checklistTickClass}>
                      ✓
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800/60 bg-neutral-950/80 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-gray-200">
              <p className="font-semibold text-white">Final check</p>
              <p className="text-gray-400">Everything is neat with room for the truck.</p>
            </div>
            <input
              type="checkbox"
              className="h-5 w-5 rounded border border-neutral-600 bg-neutral-900 accent-[#ff5757]"
              checked={checklist.neatnessConfirmed}
              onChange={handleChecklistChange("neatnessConfirmed")}
            />
          </div>
          <div
            className={`grid transition-all duration-500 ease-in-out ${
              checklist.neatnessConfirmed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
            }`}
          >
            <div className="overflow-hidden pt-4 space-y-4">
              <div>
                <img
                  src={finalPlacementImageSrc}
                  alt={finalPlacementAlt}
                  className="w-full aspect-[3/4] object-cover rounded-xl border border-neutral-800/70"
                />
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-300">
                  {finalPlacementLabel}
                </p>
              </div>
              {!isPutOutJob && (
                <p className="text-xs text-gray-400">
                  When you finish, the bins should look like this inside the property.
                </p>
              )}
              <ul className="space-y-2 text-sm text-gray-300">
                {neatnessChecklist.map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span aria-hidden="true" className={checklistTickClass}>
                      ✓
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <div className="relative flex min-h-full flex-col text-white">
      <div className="flex-1 p-6 pb-32 space-y-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#ff5757] drop-shadow-[0_6px_18px_rgba(255,87,87,0.35)]">
          {job.job_type === "put_out" ? "Put Bins Out" : "Bring Bins In"}
        </h1>
        <p className="text-lg font-semibold text-gray-200">{job.address}</p>

        {/* Checklist section */}
        {checklistContainer}

        {job.notes && (
          <div className="bg-neutral-800 border border-neutral-800/70 rounded-xl p-4 shadow-lg">
            <p className="text-sm text-gray-400 mb-1">Property Notes:</p>
            <p className="text-white font-medium">{job.notes}</p>
          </div>
        )}

        {/* photo input + preview */}
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
            disabled={!allChecklistChecked}
          />
          {preview && (
            <div className="flex flex-col items-center gap-2">
              <img src={preview} alt="preview" className="w-full aspect-[3/4] object-cover rounded-xl border border-neutral-800/70 shadow-lg" onClick={() => fileInputRef.current?.click()} />
              {!submitting && (
                <button type="button" className="text-sm text-gray-300 underline" onClick={() => fileInputRef.current?.click()}>
                  Need a new photo?
                </button>
              )}
            </div>
          )}
        </div>

        {/* note box */}
        <div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Leave any notes"
            className="w-full p-3 rounded-lg bg-neutral-900 text-white min-h-[100px] placeholder-gray-500"
          />
        </div>

        {gpsError && <div className="text-sm text-red-400"><p>{gpsError}</p></div>}
      </div>

      {/* bottom button */}
      <div className="absolute bottom-2 inset-x-0 p-4">
        <button
          onClick={() => {
            if (submitting || !allChecklistChecked) return;
            if (!file) {
              fileInputRef.current?.click();
              return;
            }
            void handleMarkDone();
          }}
          disabled={submitting || !allChecklistChecked}
          className={`w-full px-4 py-2 rounded-lg font-semibold transition relative z-10 disabled:opacity-60 disabled:cursor-not-allowed
            ${readyToSubmit ? "bg-[#ff5757] text-white hover:bg-[#e04b4b]" : "bg-neutral-900 text-white hover:bg-neutral-800"}`}
        >
          {submitting
            ? "Saving…"
            : !allChecklistChecked
            ? "Complete the checklist"
            : readyToSubmit
            ? "Mark Done"
            : "Take Photo"}
        </button>
      </div>
    </div>
  );
}
