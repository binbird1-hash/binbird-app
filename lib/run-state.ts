import type { PlannedRunPayload } from "./planned-run";
import type { RunSessionRecord } from "./run-session";

export type RunMenuState = {
  hasPlannedRun: boolean;
  showEndRun: boolean;
  lockNavigation: boolean;
};

function hasValidJobs(plannedRun: PlannedRunPayload | null): boolean {
  if (!plannedRun) return false;
  return Array.isArray(plannedRun.jobs) && plannedRun.jobs.length > 0;
}

export function isRunSessionActive(runSession: RunSessionRecord | null): boolean {
  if (!runSession) return false;
  if (!runSession.startedAt) return false;
  if (!runSession.endedAt) return true;

  const endedAtDate = new Date(runSession.endedAt);
  return Number.isNaN(endedAtDate.getTime());
}

export function deriveRunMenuState({
  plannedRun,
  runSession,
}: {
  plannedRun: PlannedRunPayload | null;
  runSession: RunSessionRecord | null;
}): RunMenuState {
  const hasPlan = hasValidJobs(plannedRun);
  const activeSession = isRunSessionActive(runSession);
  const hasStarted = Boolean(plannedRun?.hasStarted) || activeSession;

  return {
    hasPlannedRun: hasPlan,
    showEndRun: hasStarted,
    lockNavigation: hasStarted,
  };
}
