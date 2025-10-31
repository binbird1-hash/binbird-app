import { getOperationalISODate } from "./date";

export type RunSessionRecord = {
  startedAt: string;
  endedAt: string | null;
  totalJobs: number;
  completedJobs: number;
};

const RUN_SESSION_STORAGE_KEY = "binbird:active-run";

function getOperationalIsoForString(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return getOperationalISODate({ now: parsed });
}

function isRunSessionCurrent(record: RunSessionRecord): boolean {
  const sessionIso = getOperationalIsoForString(record.startedAt);
  if (!sessionIso) return false;

  const todayIso = getOperationalISODate();
  return sessionIso === todayIso;
}

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

function parseRunSession(raw: string): RunSessionRecord | null {
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.startedAt === "string" &&
      (typeof parsed.endedAt === "string" || parsed.endedAt === null) &&
      typeof parsed.totalJobs === "number" &&
      typeof parsed.completedJobs === "number"
    ) {
      return {
        startedAt: parsed.startedAt,
        endedAt: parsed.endedAt,
        totalJobs: parsed.totalJobs,
        completedJobs: parsed.completedJobs,
      };
    }
  } catch (err) {
    console.warn("Unable to parse run session data", err);
  }

  return null;
}

export function readRunSession(): RunSessionRecord | null {
  const storages = getAvailableStorages();
  if (!storages.length) return null;

  for (let index = 0; index < storages.length; index += 1) {
    const { storage } = storages[index];
    let raw: string | null = null;

    try {
      raw = storage.getItem(RUN_SESSION_STORAGE_KEY);
    } catch {
      continue;
    }

    if (!raw) continue;

    const parsed = parseRunSession(raw);
    if (parsed) {
      if (!isRunSessionCurrent(parsed)) {
        clearRunSession();
        return null;
      }

      if (index > 0) {
        writeRunSession(parsed);
      }
      return parsed;
    }
  }

  return null;
}

export function writeRunSession(record: RunSessionRecord) {
  const storages = getAvailableStorages();
  if (!storages.length) return;

  const normalized: RunSessionRecord = {
    startedAt: record.startedAt,
    endedAt: record.endedAt ?? null,
    totalJobs: Number.isFinite(record.totalJobs) ? record.totalJobs : 0,
    completedJobs: Number.isFinite(record.completedJobs) ? record.completedJobs : 0,
  };

  const payload = JSON.stringify(normalized);

  for (const { storage, type } of storages) {
    try {
      storage.setItem(RUN_SESSION_STORAGE_KEY, payload);
    } catch (err) {
      console.warn(`Unable to persist run session data in ${type}`, err);
    }
  }
}

export function clearRunSession() {
  const storages = getAvailableStorages();
  if (!storages.length) return;

  for (const { storage, type } of storages) {
    try {
      storage.removeItem(RUN_SESSION_STORAGE_KEY);
    } catch (err) {
      console.warn(`Unable to clear run session data in ${type}`, err);
    }
  }
}
