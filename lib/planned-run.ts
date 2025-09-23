import type { Job } from "./jobs";

export type PlannedRunLocation = { lat: number; lng: number };

export type PlannedRunPayload = {
  start: PlannedRunLocation;
  end: PlannedRunLocation;
  jobs: Job[];
  startAddress: string | null;
  endAddress: string | null;
  createdAt: string;
};

const PLANNED_RUN_STORAGE_KEY = "binbird:planned-run";

function isBrowser(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.sessionStorage !== "undefined"
  );
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
  return {
    id: String(value.id),
    address: typeof value.address === "string" ? value.address : "",
    lat: Number.isFinite(value.lat) ? value.lat : 0,
    lng: Number.isFinite(value.lng) ? value.lng : 0,
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
    last_completed_on:
      typeof value.last_completed_on === "string" &&
      value.last_completed_on.trim().length
        ? value.last_completed_on
        : null,
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

export function readPlannedRun(): PlannedRunPayload | null {
  if (!isBrowser()) return null;
  const raw = window.sessionStorage.getItem(PLANNED_RUN_STORAGE_KEY);
  if (!raw) return null;

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
    };
  } catch (err) {
    console.warn("Unable to parse planned run payload", err);
    return null;
  }
}

export function writePlannedRun(payload: PlannedRunPayload) {
  if (!isBrowser()) return;

  const normalized: PlannedRunPayload = {
    start: isLatLng(payload.start) ? payload.start : { lat: 0, lng: 0 },
    end: isLatLng(payload.end) ? payload.end : { lat: 0, lng: 0 },
    jobs: Array.isArray(payload.jobs)
      ? payload.jobs.map((job) => normalizeJob(job))
      : [],
    startAddress: normalizeAddress(payload.startAddress),
    endAddress: normalizeAddress(payload.endAddress),
    createdAt:
      typeof payload.createdAt === "string" && payload.createdAt.length
        ? payload.createdAt
        : new Date().toISOString(),
  };

  if (!normalized.jobs.length) return;

  try {
    window.sessionStorage.setItem(
      PLANNED_RUN_STORAGE_KEY,
      JSON.stringify(normalized)
    );
  } catch (err) {
    console.warn("Unable to persist planned run payload", err);
  }
}

export function clearPlannedRun() {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(PLANNED_RUN_STORAGE_KEY);
  } catch (err) {
    console.warn("Unable to clear planned run payload", err);
  }
}
