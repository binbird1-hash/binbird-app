import { normalizeJobStatus, type Job } from "./jobs";
import { clearActiveRunCookie, syncActiveRunCookie } from "./active-run-cookie";

export type PlannedRunLocation = { lat: number; lng: number };

export type PlannedRunPayload = {
  start: PlannedRunLocation;
  end: PlannedRunLocation;
  jobs: Job[];
  startAddress: string | null;
  endAddress: string | null;
  createdAt: string;
  hasStarted: boolean;
  nextIdx: number;
};

const PLANNED_RUN_STORAGE_KEY = "binbird:planned-run";

type StorageKey = "sessionStorage" | "localStorage";

type StorageEntry = {
  storage: Storage;
  type: StorageKey;
};

const STORAGE_CANDIDATES: StorageKey[] = ["sessionStorage", "localStorage"];

function getAvailableStorages(): StorageEntry[] {
  if (typeof window === "undefined") return [];

  const storages: StorageEntry[] = [];
  for (const key of STORAGE_CANDIDATES) {
    try {
      const storage = window[key];
      if (storage) {
        storages.push({ storage, type: key });
      }
    } catch {
      // Accessing storage can throw in private browsing modes; ignore.
    }
  }

  return storages;
}

function isLatLng(value: unknown): value is PlannedRunLocation {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { lat?: unknown }).lat === "number" &&
    Number.isFinite((value as { lat: number }).lat) &&
    typeof (value as { lng?: unknown }).lng === "number" &&
    Number.isFinite((value as { lng: number }).lng)
  );
}

function normalizeAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeJob(value: Job): Job {
  const lastCompletedOn =
    typeof value.last_completed_on === "string" && value.last_completed_on.trim().length
      ? value.last_completed_on
      : null;
  const status =
    lastCompletedOn && value.status !== "skipped" && value.status !== "completed"
      ? "completed"
      : normalizeJobStatus(value.status);

  return {
    id: String(value.id),
    account_id:
      typeof value.account_id === "string" && value.account_id.trim().length
        ? value.account_id
        : null,
    property_id:
      typeof value.property_id === "string" && value.property_id.trim().length
        ? value.property_id
        : null,
    address: typeof value.address === "string" ? value.address : "",
    lat: Number.isFinite(value.lat) ? value.lat : 0,
    lng: Number.isFinite(value.lng) ? value.lng : 0,
    status,
    job_type: value.job_type === "bring_in" ? "bring_in" : "put_out",
    bins: typeof value.bins === "string" ? value.bins : null,
    notes: typeof value.notes === "string" ? value.notes : null,
    client_name:
      typeof value.client_name === "string" && value.client_name.trim().length
        ? value.client_name
        : null,
    photo_path:
      typeof value.photo_path === "string" && value.photo_path.trim().length
        ? value.photo_path
        : null,
    last_completed_on: lastCompletedOn,
    assigned_to:
      typeof value.assigned_to === "string" && value.assigned_to.trim().length
        ? value.assigned_to
        : null,
    day_of_week:
      typeof value.day_of_week === "string" && value.day_of_week.trim().length
        ? value.day_of_week
        : null,
  };
}

function normalizeNextIdx(value: unknown, jobsLength: number): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  const numeric = Math.floor(numericValue);
  if (jobsLength <= 0) return 0;
  return Math.min(Math.max(numeric, 0), Math.max(jobsLength - 1, 0));
}

function parsePlannedRun(raw: string): PlannedRunPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PlannedRunPayload> | null;
    if (!parsed || !isLatLng(parsed.start) || !isLatLng(parsed.end)) {
      return null;
    }

    const jobsInput = Array.isArray(parsed.jobs) ? parsed.jobs : [];
    const normalizedJobs = jobsInput
      .map((job) => {
        try {
          return normalizeJob(job as Job);
        } catch {
          return null;
        }
      })
      .filter((job): job is Job => job !== null);

    if (!normalizedJobs.length) {
      return null;
    }

    const nextIdx = normalizeNextIdx(parsed.nextIdx ?? 0, normalizedJobs.length);

    return {
      start: parsed.start,
      end: parsed.end,
      jobs: normalizedJobs,
      startAddress: normalizeAddress(parsed.startAddress),
      endAddress: normalizeAddress(parsed.endAddress),
      createdAt:
        typeof parsed.createdAt === "string" && parsed.createdAt.length
          ? parsed.createdAt
          : new Date().toISOString(),
      hasStarted: Boolean(parsed.hasStarted),
      nextIdx,
    };
  } catch (err) {
    console.warn("Unable to parse planned run payload", err);
    return null;
  }
}

export function readPlannedRun(): PlannedRunPayload | null {
  const storages = getAvailableStorages();
  if (!storages.length) return null;

  for (let index = 0; index < storages.length; index += 1) {
    const { storage } = storages[index];
    let raw: string | null = null;

    try {
      raw = storage.getItem(PLANNED_RUN_STORAGE_KEY);
    } catch {
      continue;
    }

    if (!raw) continue;

    const parsed = parsePlannedRun(raw);
    if (parsed) {
      if (index > 0) {
        writePlannedRun(parsed);
      }
      return parsed;
    }
  }

  return null;
}

export function writePlannedRun(payload: PlannedRunPayload) {
  const storages = getAvailableStorages();

  const normalizedJobs = Array.isArray(payload.jobs)
    ? payload.jobs.map((job) => normalizeJob(job))
    : [];

  const normalized: PlannedRunPayload = {
    start: isLatLng(payload.start) ? payload.start : { lat: 0, lng: 0 },
    end: isLatLng(payload.end) ? payload.end : { lat: 0, lng: 0 },
    jobs: normalizedJobs,
    startAddress: normalizeAddress(payload.startAddress),
    endAddress: normalizeAddress(payload.endAddress),
    createdAt:
      typeof payload.createdAt === "string" && payload.createdAt.length
        ? payload.createdAt
        : new Date().toISOString(),
    hasStarted: Boolean(payload.hasStarted),
    nextIdx: normalizeNextIdx(payload.nextIdx ?? 0, normalizedJobs.length),
  };

  if (!normalized.jobs.length) {
    return;
  }

  const payloadJson = JSON.stringify(normalized);

  for (const { storage, type } of storages) {
    try {
      storage.setItem(PLANNED_RUN_STORAGE_KEY, payloadJson);
    } catch (err) {
      console.warn(`Unable to persist planned run payload in ${type}`, err);
    }
  }

  syncActiveRunCookie(normalized.hasStarted);
}

export function clearPlannedRun() {
  const storages = getAvailableStorages();
  for (const { storage, type } of storages) {
    try {
      storage.removeItem(PLANNED_RUN_STORAGE_KEY);
    } catch (err) {
      console.warn(`Unable to clear planned run payload in ${type}`, err);
    }
  }

  clearActiveRunCookie();
}

export function markPlannedRunStarted() {
  const existing = readPlannedRun();
  if (!existing) return;

  writePlannedRun({
    ...existing,
    hasStarted: true,
  });
}
