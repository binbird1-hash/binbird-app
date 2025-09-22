export type RunSessionRecord = {
  startedAt: string;
  endedAt: string | null;
  totalJobs: number;
  completedJobs: number;
};

const RUN_SESSION_STORAGE_KEY = "binbird:active-run";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function readRunSession(): RunSessionRecord | null {
  if (!isBrowser()) return null;
  const raw = window.sessionStorage.getItem(RUN_SESSION_STORAGE_KEY);
  if (!raw) return null;
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

export function writeRunSession(record: RunSessionRecord) {
  if (!isBrowser()) return;
  const normalized: RunSessionRecord = {
    startedAt: record.startedAt,
    endedAt: record.endedAt ?? null,
    totalJobs: Number.isFinite(record.totalJobs) ? record.totalJobs : 0,
    completedJobs: Number.isFinite(record.completedJobs) ? record.completedJobs : 0,
  };
  try {
    window.sessionStorage.setItem(
      RUN_SESSION_STORAGE_KEY,
      JSON.stringify(normalized)
    );
  } catch (err) {
    console.warn("Unable to persist run session data", err);
  }
}

export function clearRunSession() {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(RUN_SESSION_STORAGE_KEY);
  } catch (err) {
    console.warn("Unable to clear run session data", err);
  }
}
