import type { JobRecord } from "./database.types";

export type JobStatus = "scheduled" | "en_route" | "on_site" | "completed" | "skipped";

export type Job = {
  id: string;
  account_id: string | null;
  property_id: string | null;
  address: string;
  lat: number;
  lng: number;
  status: JobStatus;
  job_type: "put_out" | "bring_in";
  bins: string | null;
  notes: string | null;
  client_name: string | null;
  photo_path: string | null;
  last_completed_on: string | null;
  assigned_to: string | null;
  day_of_week: string | null;
};

const JOB_STATUS_VALUES: readonly JobStatus[] = [
  "scheduled",
  "en_route",
  "on_site",
  "completed",
  "skipped",
];

const JOB_STATUS_SET = new Set<JobStatus>(JOB_STATUS_VALUES);

export function normalizeJobStatus(value: unknown): JobStatus {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase() as JobStatus;
    if (JOB_STATUS_SET.has(normalized)) {
      return normalized;
    }
  }
  return "scheduled";
}

function normalizeString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (!value) {
    return "";
  }
  return String(value).trim();
}

function normalizeOptionalString(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized.length ? normalized : null;
}

function normalizeNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDate(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.length) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    const dateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      return dateMatch[1];
    }
    return trimmed;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return null;
}

function normalizeJobType(value: unknown): "put_out" | "bring_in" {
  const raw = normalizeString(value).toLowerCase();
  if (!raw.length) return "put_out";

  const cleaned = raw.replace(/[-\s]/g, "_");
  if (
    cleaned === "bring_in" ||
    cleaned === "bringin" ||
    cleaned === "bring" ||
    cleaned === "in" ||
    cleaned.endsWith("_in")
  ) {
    return "bring_in";
  }

  return "put_out";
}

export function normalizeJob<T extends Partial<JobRecord>>(record: T): Job {
  const lastCompletedOn = normalizeDate(record.last_completed_on);
  const baseStatus = normalizeJobStatus(record.status);
  const status =
    lastCompletedOn && baseStatus !== "skipped" && baseStatus !== "completed"
      ? "completed"
      : baseStatus;

  return {
    id: normalizeString(record.id),
    account_id: normalizeOptionalString(record.account_id),
    property_id: normalizeOptionalString(record.property_id),
    address: normalizeString(record.address),
    lat: normalizeNumber(record.lat),
    lng: normalizeNumber(record.lng),
    status,
    job_type: normalizeJobType(record.job_type),
    bins: normalizeOptionalString(record.bins),
    notes: normalizeOptionalString(record.notes),
    client_name: normalizeOptionalString(record.client_name),
    photo_path: normalizeOptionalString(record.photo_path),
    last_completed_on: lastCompletedOn,
    assigned_to: normalizeOptionalString(record.assigned_to),
    day_of_week: record.day_of_week
      ? String(record.day_of_week).trim()
      : null,
  };
}


export function normalizeJobs<T extends Partial<JobRecord>>(
  records: T[] | null | undefined
): Job[] {
  if (!records) return [];
  return records.map((record) => normalizeJob(record));
}
