"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { getOperationalISODate, getJobVisibilityRestrictions } from "@/lib/date";
import { normalizeJobs, type Job } from "@/lib/jobs";
import {
  clearRunSession,
  readRunSession,
  writeRunSession,
  type RunSessionRecord,
} from "@/lib/run-session";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { clearPlannedRun, readPlannedRun, writePlannedRun } from "@/lib/planned-run";

const PUT_OUT_PLACEHOLDER_URL =
  "/images/put-out-placeholder.jpg";
const BRING_IN_PLACEHOLDER_URL =
  "/images/bring-in-placeholder.jpg";

const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";
const RUN_ROLLOVER_MESSAGE = "Your previous run has ended. Please start a new run.";

const referenceImagePreloadCache = new Map<string, Promise<void>>();

function preloadImage(url: string) {
  if (referenceImagePreloadCache.has(url)) {
    return referenceImagePreloadCache.get(url)!;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const img = new Image();
    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
    };

    img.onload = () => {
      cleanup();
      resolve();
    };
    img.onerror = () => {
      cleanup();
      reject(new Error("Failed to preload image"));
    };
    img.src = url;

    if (typeof img.decode === "function") {
      img
        .decode()
        .then(() => {
          cleanup();
          resolve();
        })
        .catch(() => {
          // If decode fails, rely on load event.
        });
    }
  });

  const trackedPromise = promise.catch((error) => {
    referenceImagePreloadCache.delete(url);
    throw error;
  });

  referenceImagePreloadCache.set(url, trackedPromise);
  return trackedPromise;
}

function getAlternatingPhotoPath(basePath: string | null, currentDate: Date): string | null {
  if (!basePath) return null;

  const segments = basePath.split("/");
  if (!segments.length) return null;

  const baseWeekSegment = segments[segments.length - 1];
  const baseWeekMatch = /^Week-(\d+)$/i.exec(baseWeekSegment ?? "");
  const baseWeekNumber = baseWeekMatch ? Number.parseInt(baseWeekMatch[1], 10) : null;

  if (!baseWeekNumber || Number.isNaN(baseWeekNumber)) {
    return basePath;
  }

  const { week: currentWeekLabel } = getCustomWeek(currentDate);
  const currentWeekMatch = /^Week-(\d+)$/i.exec(currentWeekLabel);
  const currentWeekNumber = currentWeekMatch ? Number.parseInt(currentWeekMatch[1], 10) : null;

  if (!currentWeekNumber || Number.isNaN(currentWeekNumber)) {
    return basePath;
  }

  const shouldUseAlternateWeek = Math.abs(currentWeekNumber - baseWeekNumber) % 2 === 1;
  const effectiveWeekNumber = baseWeekNumber + (shouldUseAlternateWeek ? 1 : 0);

  const updatedSegments = [...segments];
  updatedSegments[updatedSegments.length - 1] = `Week-${effectiveWeekNumber}`;

  return updatedSegments.join("/");
}

// kebab-case helper
function toKebab(value: string | null | undefined, fallback: string): string {
  if (!value || typeof value !== "string") return fallback;
  return value
    .toLowerCase()
    .replace(/,\s*/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function generateSequentialFileName(
  baseName: string,
  extension: string,
  existingNames: string[],
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

function isDuplicateStorageError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  const possible = err as { statusCode?: number; message?: string; error?: string };
  if (typeof possible.statusCode === "number" && possible.statusCode === 409) {
    return true;
  }

  const message =
    typeof possible.message === "string"
      ? possible.message
      : typeof possible.error === "string"
        ? possible.error
        : "";

  if (!message) return false;
  const lowered = message.toLowerCase();
  return lowered.includes("already exists") || lowered.includes("duplicate");
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
  const supabase = useSupabase();
  const params = useSearchParams();
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
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

  const filterJobsForVisibility = useCallback((jobsList: Job[]) => {
    const visibility = getJobVisibilityRestrictions();
    return jobsList.filter((job) => {
      if (job.job_type === "bring_in") {
        return !visibility.bringIn;
      }

      if (job.job_type === "put_out") {
        return !visibility.putOut;
      }

      return true;
    });
  }, []);
  const hasRedirectedRef = useRef(false);
  const operationalDayRef = useRef(getOperationalISODate(new Date()));
  const rolloverHandledRef = useRef(false);

  const redirectToLogin = useCallback(() => {
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;
    alert(SESSION_EXPIRED_MESSAGE);
    router.replace("/auth/login");
  }, [router]);


  useEffect(() => {
    let isActive = true;

    async function verifySession() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!isActive) return;

        if (error) {
          console.error("Failed to verify staff session", error);
          redirectToLogin();
          return;
        }

        if (!session?.user) {
          console.warn("[ProofPageContent] no session user found");
          redirectToLogin();
          return;
        }

        setAuthChecked(true);
      } catch (unknownError) {
        if (!isActive) return;
        console.error("Unexpected error verifying staff session", unknownError);
        redirectToLogin();
      }
    }

    verifySession();

    return () => {
      isActive = false;
    };
  }, [redirectToLogin, supabase]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const enforceFreshOperationalDay = () => {
      const currentDay = getOperationalISODate(new Date());
      if (operationalDayRef.current === currentDay) {
        return;
      }

      operationalDayRef.current = currentDay;
      clearRunSession();
      clearPlannedRun();
      setJobs([]);
      setIdx(0);
      setReferenceUrls({ putOut: null, bringIn: null });
      setReferenceLookupComplete(false);
      setFile(null);
      setPreview(null);
      setNote("");
      setSubmitting(false);
      setChecklist({
        propertyConfirmed: false,
        binColoursConfirmed: false,
        placementUnderstood: false,
        neatnessConfirmed: false,
      });

      if (!rolloverHandledRef.current) {
        rolloverHandledRef.current = true;
        alert(RUN_ROLLOVER_MESSAGE);
        router.replace("/staff/run");
      }
    };

    enforceFreshOperationalDay();
    const interval = window.setInterval(enforceFreshOperationalDay, 60_000);

    return () => window.clearInterval(interval);
  }, [router]);

  // parse jobs + idx from params
  useEffect(() => {
    try {
      const rawJobs = params.get("jobs");
      const rawIdx = params.get("idx");
      if (rawJobs) {
        const parsed = JSON.parse(rawJobs);
        if (Array.isArray(parsed)) {
          setJobs(filterJobsForVisibility(normalizeJobs(parsed)));
        } else {
          console.warn("[ProofPageContent] jobs param was not an array", parsed);
        }
      }
      if (rawIdx) {
        const parsedIdx = parseInt(rawIdx, 10);
        if (!Number.isNaN(parsedIdx)) setIdx(parsedIdx);
        else console.warn("[ProofPageContent] idx param was NaN", rawIdx);
      }
    } catch (err) {
      console.error("Parse failed:", err);
    }
  }, [filterJobsForVisibility, params]);

  const getActiveRunSession = useCallback(() => {
    const existing = readRunSession();
    if (!existing) return null;
    if (existing.endedAt) {
      const endDate = new Date(existing.endedAt);
      if (!Number.isNaN(endDate.getTime())) return null;
    }
    return existing;
  }, []);

  const currentIdx = Math.min(idx, Math.max(jobs.length - 1, 0));
  const job = jobs[currentIdx];
  const jobId = job?.id ?? null;
  const photoPath = job?.photo_path ?? null;
  const alternatingPhotoPath = getAlternatingPhotoPath(photoPath, new Date());

  useEffect(() => {
    let isCancelled = false;

    if (!alternatingPhotoPath) {
      setReferenceUrls({ putOut: null, bringIn: null });
      setReferenceLookupComplete(false);
      return () => {
        isCancelled = true;
      };
    }

    setReferenceLookupComplete(false);
    setReferenceUrls({ putOut: null, bringIn: null });

    async function fetchReferenceImages() {
      const bucket = supabase.storage.from("proofs");

      try {
        const [putOutRes, bringInRes] = await Promise.all([
          bucket.createSignedUrl(`${alternatingPhotoPath}/Put Out.jpg`, 3600),
          bucket.createSignedUrl(`${alternatingPhotoPath}/Bring In.jpg`, 3600),
        ]);

        if (isCancelled) return;

        const putOutUrl = putOutRes.data?.signedUrl ?? null;
        const bringInUrl = bringInRes.data?.signedUrl ?? null;

        await Promise.all([
          putOutUrl ? preloadImage(putOutUrl) : Promise.resolve(),
          bringInUrl ? preloadImage(bringInUrl) : Promise.resolve(),
        ]);

        if (isCancelled) return;

        setReferenceUrls({ putOut: putOutUrl, bringIn: bringInUrl });
      } catch (error) {
        console.warn("[ProofPageContent] Unable to load reference images", error);
        if (!isCancelled) {
          setReferenceUrls({ putOut: null, bringIn: null });
        }
      } finally {
        if (!isCancelled) {
          setReferenceLookupComplete(true);
        }
      }
    }

    void fetchReferenceImages();

    return () => {
      isCancelled = true;
    };
  }, [alternatingPhotoPath, supabase]);

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
        console.error("[ProofPageContent] gps error", error);
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

  useEffect(() => {
    if (!jobId) return;
    setChecklist({
      propertyConfirmed: false,
      binColoursConfirmed: false,
      placementUnderstood: false,
      neatnessConfirmed: false,
    });
    setFile(null);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [jobId]);

  if (!authChecked) {
    return <div className="p-6 text-white">Checking session…</div>;
  }

  if (!job) return <div className="p-6 text-white">No job found.</div>;

  // bins helpers
  function getParsedBins(bins: string | null | undefined) {
    if (!bins) return [] as string[];
    return bins.split(",").map((b) => b.trim()).filter(Boolean);
  }
  const parsedBins = getParsedBins(job.bins);

  function getBinColorStyles(bin: string) {
    const normalized = bin.toLowerCase();
    if (normalized.includes("red") || normalized.includes("waste"))
      return {
        className: "",
        backgroundClass: "",
        style: {
          backgroundImage:
            "linear-gradient(90deg,#ef4444 0%,#ef4444 50%,#003000 50%,#003000 100%)",
          backgroundClip: "padding-box",
        },
        text: "text-white",
      };
    if (normalized.includes("yellow") || normalized.includes("recycling"))
      return {
        className: "",
        backgroundClass: "",
        style: {
          backgroundImage:
            "linear-gradient(90deg,#facc15 0%,#facc15 50%,#00BFFF 50%,#00BFFF 100%)",
          backgroundClip: "padding-box",
        },
        text: "text-slate-900",
      };
    if (normalized.includes("green") || normalized.includes("fogo"))
      return {
        className: "",
        backgroundClass: "bg-emerald-600",
        style: {},
        text: "text-white",
      };
    return { className: "", backgroundClass: "bg-neutral-800", style: {}, text: "text-white" };
  }
  function getBinLabel(bin: string) {
    const normalized = bin.toLowerCase();
    if (normalized.includes("red") || normalized.includes("waste")) return "All Waste Bins";
    if (normalized.includes("yellow") || normalized.includes("recycling")) return "All Recycling Bins";
    if (normalized.includes("green") || normalized.includes("fogo")) return "All FOGO Bins";
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
          className={`w-full rounded-xl px-4 py-2 text-center text-base font-bold ${styles.className} ${styles.backgroundClass ?? ""}`}
          style={styles.style}
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
    if (!allChecklistChecked) {
      alert("Please complete the checklist before submitting proof.");
      return;
    }
    const accountId = job.account_id ?? null;
    setSubmitting(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        console.warn("[ProofPageContent] no user returned, redirecting");
        setSubmitting(false);
        redirectToLogin();
        return;
      }
      const now = new Date();
      const dateStr = getOperationalISODate(now);
      const { year, week } = getCustomWeek(now);
      const safeClient = toKebab(job.client_name, "unknown-client");
      const safeAddress = toKebab(job.address, "unknown-address");
      const folderPath = `${safeClient}/${safeAddress}/${year}/${week}`;
      const baseFileName = job.job_type === "bring_in" ? "Bring In" : "Put Out";
      const fileExtension = ".jpg";
      const bucket = supabase.storage.from("proofs");
      const { data: existingFiles, error: listErr } = await bucket.list(folderPath, { limit: 100 });
      if (listErr) {
        console.warn("Unable to check existing proof photos", listErr);
      }
      const existingNames = existingFiles?.map((existingFile) => existingFile.name) ?? [];
      const attemptedNames = new Set(existingNames);
      let fileLabel = generateSequentialFileName(baseFileName, fileExtension, existingNames);
      let uploadError: unknown = null;
      let path: string | null = null;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        attemptedNames.add(fileLabel);
        const uploadFile = await prepareFileAsJpeg(file, fileLabel);
        const candidatePath = `${folderPath}/${fileLabel}`;
        const { error: uploadErr } = await bucket.upload(candidatePath, uploadFile, { upsert: false });

        if (!uploadErr) {
          path = candidatePath;
          break;
        }

        uploadError = uploadErr;
        if (!isDuplicateStorageError(uploadErr)) {
          throw uploadErr;
        }

        fileLabel = generateSequentialFileName(
          baseFileName,
          fileExtension,
          Array.from(attemptedNames),
        );
      }

      if (!path) {
        const fallbackLabel = `${baseFileName} ${Date.now()}${fileExtension}`;
        const fallbackFile = await prepareFileAsJpeg(file, fallbackLabel);
        const fallbackPath = `${folderPath}/${fallbackLabel}`;
        const { error: fallbackError } = await bucket.upload(fallbackPath, fallbackFile, { upsert: false });
        if (fallbackError) {
          throw uploadError ?? fallbackError;
        }
        path = fallbackPath;
      }
      const staffNote = note.trim();
      const noteValue = staffNote.length ? staffNote : null;
      const { error: logErr } = await supabase.from("logs").insert({
        job_id: job.id,
        account_id: accountId,
        property_id: job.property_id ?? null,
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
      console.error("[ProofPageContent] handleMarkDone error", err);
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
  const propertyReferenceLabel = isPutOutJob ? null : "";
  const propertyReferenceAlt = "Property reference";
  const finalPlacementImageSrc = isPutOutJob ? endImageSrc : bringInImageSrc;
  const finalPlacementAlt = isPutOutJob
    ? `${endLocationLabel} reference`
    : "Bins returned to property reference";
  const neatnessChecklist = isPutOutJob
    ? [
        "Bins are on the kerb in a straight line with space between each one.",
        "There is clear room for the truck to collect and nothing blocks the road or footpath.",
        "Lids are closed tight and the area is tidy.",
      ]
    : [
        "Bins are parked neatly in the storage area.",
        "Doors, paths, and emergency exits are clear.",
        "Lids are closed tight and the area is tidy.",
      ];

  const checklistValues = Object.entries(checklist).filter(
    ([key]) => isPutOutJob || key !== "placementUnderstood"
  );
  const allChecklistChecked = checklistValues.every(([, value]) => Boolean(value));
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
              <p className="font-semibold text-white">Confirm the property</p>
              <p className="text-gray-400">I am at {job.address}.</p>
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
                  {propertyReferenceLabel && (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-300">
                      {propertyReferenceLabel}
                    </p>
                  )}
                </div>
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

        {isPutOutJob && (
          <div className="rounded-2xl border border-neutral-800/60 bg-neutral-950/80 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-gray-200">
                <p className="font-semibold text-white">Stage the bins like this</p>
                <p className="text-gray-400">Match the spacing shown below when you move the bins.</p>
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
              <div className="overflow-hidden pt-4">
                <div className="rounded-xl border border-neutral-800/70 bg-neutral-900/60 p-3">
                  <img
                    src="/images/binPlacement.png"
                    alt="Example spacing for bins"
                    className="w-full h-auto rounded-lg object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-neutral-800/60 bg-neutral-950/80 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-gray-200">
              <p className="font-semibold text-white">Final check</p>
              <p className="text-gray-400">
                {isPutOutJob
                  ? "Line the bins like the image."
                  : "Bins are returned to property as shown below."}
              </p>
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
              </div>
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
        <div className="rounded-2xl border border-neutral-800/60 bg-neutral-950/80 p-4 shadow-sm">
          <div className="space-y-1 text-sm text-gray-200">
            <p className="font-semibold text-white">Leave a note (optional)</p>
            <p className="text-gray-400">Share anything unusual or helpful for the next visit.</p>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a quick note"
            className="mt-4 w-full min-h-[110px] resize-y rounded-xl border border-neutral-800/70 bg-neutral-900 p-3 text-sm text-white placeholder-gray-500 focus:border-[#ff5757] focus:outline-none focus:ring-2 focus:ring-[#ff5757]/40"
          />
        </div>
      </div>
    </section>
  );

  return (
    <div className="relative flex min-h-full flex-col text-white">
      <div className="flex-1 space-y-6 p-6 pb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#ff5757] drop-shadow-[0_6px_18px_rgba(255,87,87,0.35)]">
          {job.job_type === "put_out" ? "Put Bins Out" : "Bring Bins In"}
        </h1>
        <p className="text-lg font-semibold text-gray-200">{job.address}</p>

        {/* Checklist section */}
        {checklistContainer}

        {job.notes && (
          <div className="rounded-2xl border border-neutral-800/60 bg-neutral-950/80 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-800/70 bg-neutral-900/70 text-lg font-semibold text-[#ff5757]"
              >
                !
              </div>
              <div className="space-y-2 text-sm text-gray-200">
                <p className="text-base font-semibold text-white">Owner&apos;s Instructions</p>
                <p className="whitespace-pre-line leading-relaxed text-gray-300">{job.notes}</p>
              </div>
            </div>
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
              <img
                src={preview}
                alt="preview"
                className="w-full aspect-[3/4] object-cover rounded-xl border border-neutral-800/70 shadow-lg"
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

        {gpsError && (
          <div className="text-sm text-red-400">
            <p>{gpsError}</p>
          </div>
        )}
      </div>

      {/* bottom button */}
      <div className="sticky bottom-0 inset-x-0 z-20 border-t border-white/10 bg-black/95 p-4 backdrop-blur">
        <div className="pb-[env(safe-area-inset-bottom)]">
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
            className={`relative z-10 w-full rounded-lg px-4 py-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60
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
    </div>
  );
}
