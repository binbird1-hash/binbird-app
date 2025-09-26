"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { MapSettingsProvider } from "@/components/Context/MapSettingsContext";
import SettingsDrawer from "@/components/UI/SettingsDrawer";
import {
  clearRunSession,
  readRunSession,
  RunSessionRecord,
} from "@/lib/run-session";
import { clearPlannedRun } from "@/lib/planned-run";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type NextAssignment = {
  day: string;
  address: string;
  totalJobs: number;
  clientName: string | null;
};

type AssignmentState = "loading" | "ready" | "error";

type AssignmentJob = {
  day: string;
  address: string;
  clientName: string | null;
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(Math.round(ms / 1000), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!hours && !minutes) parts.push(`${seconds}s`);
  else if (!hours && minutes < 10 && seconds) parts.push(`${seconds}s`);

  return parts.join(" ") || "0s";
}

function formatTimestamp(input: string | null): string | null {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;

  const datePart = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timePart = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${datePart} • ${timePart}`;
}

function CompletedRunContent() {
  const router = useRouter();
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [runData, setRunData] = useState<RunSessionRecord | null | undefined>(
    undefined,
  );
  const [assignmentStatus, setAssignmentStatus] =
    useState<AssignmentState>("loading");
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [nextAssignment, setNextAssignment] = useState<NextAssignment | null>(
    null,
  );

  const todayName = useMemo(() => {
    const override = process.env.NEXT_PUBLIC_DEV_DAY_OVERRIDE;
    if (override) return override;
    return new Date().toLocaleDateString("en-US", { weekday: "long" });
  }, []);

  const todayIndex = WEEKDAYS.indexOf(todayName);

  useEffect(() => {
    if (typeof window === "undefined") {
      setRunData(null);
      return;
    }

    const stored = readRunSession();
    setRunData(stored);
    clearRunSession();
    clearPlannedRun();
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadNextAssignment() {
      try {
        setAssignmentStatus("loading");
        setAssignmentError(null);

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) throw authError;

        if (!user) {
          if (!isActive) return;
          setAssignmentStatus("error");
          setAssignmentError("Sign in to see upcoming assignments.");
          setNextAssignment(null);
          return;
        }

        const { data, error } = await supabase
          .from("jobs")
          .select("address, day_of_week, client_name")
          .eq("assigned_to", user.id);

        if (error) throw error;

        const normalized: AssignmentJob[] = Array.isArray(data)
          ? data
              .map((job) => {
                const day =
                  typeof job?.day_of_week === "string" ? job.day_of_week : "";
                const addressValue =
                  typeof job?.address === "string" ? job.address.trim() : "";
                const clientValue = job?.client_name;
                const clientName =
                  typeof clientValue === "string" && clientValue.trim().length
                    ? clientValue.trim()
                    : typeof clientValue === "number"
                      ? String(clientValue)
                      : null;

                return {
                  day,
                  address: addressValue.length ? addressValue : "Address TBC",
                  clientName,
                };
              })
              .filter((job) => job.day.length > 0)
          : [];

        const jobsByDay = new Map<string, AssignmentJob[]>();
        normalized.forEach((job) => {
          const list = jobsByDay.get(job.day) ?? [];
          list.push(job);
          jobsByDay.set(job.day, list);
        });

        const fallbackIndex = new Date().getDay();
        const startIndex = todayIndex >= 0 ? todayIndex : fallbackIndex;

        let found: NextAssignment | null = null;

        const todayJobs = jobsByDay.get(todayName);
        if (todayJobs && todayJobs.length > 0) {
          const [primary] = todayJobs;
          found = {
            day: "Today",
            address: primary.address,
            clientName:
              typeof primary.clientName === "string"
                ? primary.clientName
                : null,
            totalJobs: todayJobs.length,
          };
        } else {
          for (let offset = 1; offset <= WEEKDAYS.length; offset += 1) {
            const idx = (startIndex + offset) % WEEKDAYS.length;
            const dayName = WEEKDAYS[idx];
            const jobsForDay = jobsByDay.get(dayName);
            if (jobsForDay && jobsForDay.length > 0) {
              const [primary] = jobsForDay;
              found = {
                day: dayName,
                address: primary.address,
                clientName:
                  typeof primary.clientName === "string"
                    ? primary.clientName
                    : null,
                totalJobs: jobsForDay.length,
              };
              break;
            }
          }
        }

        if (!isActive) return;

        setAssignmentStatus("ready");
        setNextAssignment(found);
        setAssignmentError(null);
      } catch (err) {
        console.error("Unable to load next assignment", err);
        if (!isActive) return;
        setAssignmentStatus("error");
        setAssignmentError(
          "We couldn't load your upcoming assignments right now.",
        );
      }
    }

    loadNextAssignment();

    return () => {
      isActive = false;
    };
  }, [supabase, todayIndex]);

  const derivedStats = useMemo(() => {
    if (!runData) {
      return {
        durationLabel: runData === undefined ? "" : "—",
        startLabel: null as string | null,
        endLabel: null as string | null,
        jobsCompleted: runData === undefined ? undefined : 0,
        totalJobs: runData === undefined ? undefined : 0,
        avgPerJob: runData === undefined ? "" : "—",
      };
    }

    const parseDate = (value: string | null) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const startDate = parseDate(runData.startedAt);
    const endDate = parseDate(runData.endedAt);

    let durationMs: number | null = null;
    if (startDate && endDate) {
      const diff = endDate.getTime() - startDate.getTime();
      if (diff >= 0) durationMs = diff;
    }

    const totalJobs = Number.isFinite(runData.totalJobs)
      ? runData.totalJobs
      : runData.completedJobs;
    const jobsCompleted = Math.min(
      Number.isFinite(runData.completedJobs) ? runData.completedJobs : 0,
      totalJobs,
    );

    const durationLabel =
      durationMs !== null ? formatDuration(durationMs) : "—";
    const avgPerJob =
      durationMs !== null && jobsCompleted > 0
        ? formatDuration(Math.round(durationMs / jobsCompleted))
        : "—";

    return {
      durationLabel,
      startLabel: formatTimestamp(runData.startedAt),
      endLabel: formatTimestamp(runData.endedAt),
      jobsCompleted,
      totalJobs,
      avgPerJob,
    };
  }, [runData]);

  const completionPercent = useMemo(() => {
    if (
      typeof derivedStats.totalJobs === "number" &&
      derivedStats.totalJobs > 0 &&
      typeof derivedStats.jobsCompleted === "number"
    ) {
      const ratio =
        (Math.min(derivedStats.jobsCompleted, derivedStats.totalJobs) /
          derivedStats.totalJobs) *
        100;
      return Math.round(ratio);
    }
    return null;
  }, [derivedStats.jobsCompleted, derivedStats.totalJobs]);

  return (
    <div className="relative flex flex-1 flex-col bg-black text-white">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-6 pt-8 pb-32 sm:pt-12">
          <header className="space-y-3 text-center sm:text-left">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#ff5757]">
              Run Complete!
            </h1>
            <p className="text-base text-gray-200 sm:text-lg">
              <span className="block">Nice work there.</span>
              <span className="block">
                Here&apos;s a quick recap of your shift.
              </span>
            </p>
          </header>

          <div className="mt-8 pb-32">
            <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-neutral-900 p-6 shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-white">
                  Run Summary
                </h2>
                {runData === undefined && (
                  <span className="text-sm text-gray-400">Loading…</span>
                )}
              </div>

              <div className="space-y-6">
                {runData === undefined ? (
                  <div className="space-y-4">
                    <div className="h-12 w-full animate-pulse rounded-xl bg-white/5" />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="h-20 animate-pulse rounded-xl bg-white/5" />
                      <div className="h-20 animate-pulse rounded-xl bg-white/5" />
                      <div className="h-20 animate-pulse rounded-xl bg-white/5" />
                      <div className="h-20 animate-pulse rounded-xl bg-white/5" />
                    </div>
                  </div>
                ) : runData === null ? (
                  <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-gray-300">
                    <p>
                      We couldn&apos;t find any details from your most recent
                      run.
                    </p>
                    <p className="mt-2 text-gray-400">
                      Start a new run to see a full summary here once
                      you&apos;re finished.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-white/10 bg-black/40 p-4 sm:p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className="text-sm uppercase tracking-wide text-gray-400">
                            Jobs Completed
                          </p>
                          <p className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                            {typeof derivedStats.jobsCompleted === "number"
                              ? derivedStats.jobsCompleted
                              : "—"}
                            {typeof derivedStats.totalJobs === "number" && (
                              <span className="ml-2 text-lg font-semibold text-gray-400">
                                / {derivedStats.totalJobs}
                              </span>
                            )}
                          </p>
                        </div>
                        {completionPercent !== null && (
                          <span className="rounded-full border border-white/10 px-3 py-1 text-sm font-medium text-gray-200">
                            {completionPercent}% complete
                          </span>
                        )}
                      </div>
                      {completionPercent !== null && (
                        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-[#ff5757]"
                            style={{
                              width: `${Math.min(Math.max(completionPercent, 0), 100)}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                        <dt className="text-sm text-gray-400">Run Duration</dt>
                        <dd className="mt-2 text-lg font-semibold text-white">
                          {derivedStats.durationLabel}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                        <dt className="text-sm text-gray-400">
                          Average per Job
                        </dt>
                        <dd className="mt-2 text-lg font-semibold text-white">
                          {derivedStats.avgPerJob}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                        <dt className="text-sm text-gray-400">Started</dt>
                        <dd className="mt-2 text-lg font-semibold text-white">
                          {derivedStats.startLabel ?? "—"}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                        <dt className="text-sm text-gray-400">Finished</dt>
                        <dd className="mt-2 text-lg font-semibold text-white">
                          {derivedStats.endLabel ?? "—"}
                        </dd>
                      </div>
                    </dl>
                  </>
                )}

                <div className="space-y-3 rounded-xl border border-white/10 bg-black/40 p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
                      Next Assignment
                    </h3>
                    {assignmentStatus === "loading" && (
                      <span className="text-xs text-gray-400">Loading…</span>
                    )}
                  </div>

                  {assignmentStatus === "error" ? (
                    <p className="text-sm text-gray-300">{assignmentError}</p>
                  ) : nextAssignment ? (
                    <div className="space-y-2">
                      <p className="text-xl font-semibold text-white">
                        {nextAssignment.day}
                      </p>
                      <p className="text-sm text-gray-300">
                        {nextAssignment.address}
                      </p>
                      {nextAssignment.clientName && (
                        <p className="text-sm text-gray-400">
                          Client: {nextAssignment.clientName}
                        </p>
                      )}
                      <p className="text-sm font-medium text-gray-200">
                        {nextAssignment.totalJobs} job
                        {nextAssignment.totalJobs === 1 ? "" : "s"} scheduled
                      </p>
                    </div>
                  ) : assignmentStatus === "loading" ? (
                    <div className="space-y-2">
                      <div className="h-4 w-1/2 animate-pulse rounded bg-white/5" />
                      <div className="h-3 w-3/4 animate-pulse rounded bg-white/5" />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-300">
                      You&apos;re all caught up. No upcoming assignments were
                      found.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 border-t border-white/10 bg-black/95 px-6 py-6 backdrop-blur">
          <div className="mx-auto w-full max-w-4xl">
            <button
              type="button"
              onClick={() => router.push("/staff/run")}
              className="w-full rounded-lg bg-[#ff5757] px-4 py-3 font-bold text-white transition hover:opacity-90"
            >
              End Run
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CompletedRunPage() {
  return (
    <MapSettingsProvider>
      <div className="relative flex min-h-screen flex-1 flex-col bg-black text-white">
        <SettingsDrawer />
        <CompletedRunContent />
      </div>
    </MapSettingsProvider>
  );
}
