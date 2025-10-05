"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MapSettingsProvider } from "@/components/Context/MapSettingsContext";
import SettingsDrawer from "@/components/UI/SettingsDrawer";
import {
  clearRunSession,
  readRunSession,
  RunSessionRecord,
} from "@/lib/run-session";
import { clearPlannedRun } from "@/lib/planned-run";
import { useSupabase } from "@/components/providers/SupabaseProvider";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type NextAssignmentDateParts = {
  weekday: string;
  month: string;
  day: number;
  ordinalSuffix: string;
};

type NextAssignment = {
  totalJobs: number;
  isToday: boolean;
  dateParts: NextAssignmentDateParts;
};

type AssignmentState = "loading" | "ready" | "error";

type AssignmentJob = {
  day: string;
  lastCompletedOn: string | null;
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

function getOrdinalSuffix(day: number): string {
  const remainder = day % 100;
  if (remainder >= 11 && remainder <= 13) {
    return "th";
  }

  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function formatNextAssignmentDateParts(date: Date): NextAssignmentDateParts {
  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  const month = date.toLocaleDateString(undefined, { month: "long" });
  const day = date.getDate();

  return {
    weekday,
    month,
    day,
    ordinalSuffix: getOrdinalSuffix(day),
  };
}

function CompletedRunContent() {
  const router = useRouter();
  const supabase = useSupabase();
  const [runData, setRunData] = useState<RunSessionRecord | null | undefined>(
    undefined
  );
  const [assignmentStatus, setAssignmentStatus] = useState<AssignmentState>(
    "loading"
  );
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [nextAssignment, setNextAssignment] = useState<NextAssignment | null>(
    null
  );

  const todayName = useMemo(() => {
    const override = process.env.NEXT_PUBLIC_DEV_DAY_OVERRIDE;
    if (override) return override;
    return new Date().toLocaleDateString("en-US", { weekday: "long" });
  }, []);

  const todayIndex = WEEKDAYS.indexOf(todayName);

  const todayIso = useMemo(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  }, []);

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
          .select("day_of_week, last_completed_on")
          .eq("assigned_to", user.id);

        if (error) throw error;

        const normalized: AssignmentJob[] = Array.isArray(data)
          ? data
              .map((job) => {
                const rawDay =
                  typeof job?.day_of_week === "string" ? job.day_of_week : "";
                const trimmedDay = rawDay.trim();
                const canonicalDay = WEEKDAYS.find(
                  (weekday) =>
                    weekday.toLowerCase() === trimmedDay.toLowerCase()
                );
                const day = canonicalDay ?? trimmedDay;
                const lastCompletedRaw = job?.last_completed_on;
                let lastCompletedOn: string | null = null;
                if (typeof lastCompletedRaw === "string") {
                  const trimmed = lastCompletedRaw.trim();
                  if (trimmed.length >= 10) {
                    lastCompletedOn = trimmed.slice(0, 10);
                  } else if (trimmed.length) {
                    lastCompletedOn = trimmed;
                  }
                } else if (lastCompletedRaw instanceof Date) {
                  lastCompletedOn = lastCompletedRaw.toISOString().slice(0, 10);
                }

                return {
                  day,
                  lastCompletedOn,
                };
              })
              .filter((job) => job.day.length > 0)
          : [];

        const jobsByDay = new Map<string, AssignmentJob[]>();
        normalized.forEach((job) => {
          const matchesToday =
            todayName &&
            job.day.toLowerCase() === todayName.toLowerCase();
          const completedToday =
            matchesToday && job.lastCompletedOn === todayIso;
          if (completedToday) {
            return;
          }

          const list = jobsByDay.get(job.day) ?? [];
          list.push(job);
          jobsByDay.set(job.day, list);
        });

        const now = new Date();
        const fallbackIndex = now.getDay();
        const startIndex = todayIndex >= 0 ? todayIndex : fallbackIndex;

        let found: NextAssignment | null = null;

        const canonicalTodayName =
          todayIndex >= 0 ? todayName : WEEKDAYS[startIndex];
        const todayJobs = jobsByDay.get(canonicalTodayName);
        if (todayJobs && todayJobs.length > 0) {
          found = {
            totalJobs: todayJobs.length,
            isToday: true,
            dateParts: formatNextAssignmentDateParts(now),
          };
        } else {
          for (let offset = 1; offset <= WEEKDAYS.length; offset += 1) {
            const idx = (startIndex + offset) % WEEKDAYS.length;
            const dayName = WEEKDAYS[idx];
            const jobsForDay = jobsByDay.get(dayName);
            if (jobsForDay && jobsForDay.length > 0) {
              const nextDate = new Date(now);
              nextDate.setDate(now.getDate() + offset);
              found = {
                totalJobs: jobsForDay.length,
                isToday: false,
                dateParts: formatNextAssignmentDateParts(nextDate),
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
          "We couldn't load your upcoming assignments right now."
        );
      }
    }

    loadNextAssignment();

    return () => {
      isActive = false;
    };
  }, [supabase, todayIndex, todayName, todayIso]);

  const derivedStats = useMemo(() => {
    if (!runData) {
      return {
        durationLabel: runData === undefined ? "" : "—",
        startLabel: null as string | null,
        endLabel: null as string | null,
        jobsCompleted: 0,
        totalJobs: 0,
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
      totalJobs
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

  return (

    <div className="flex flex-1 flex-col bg-black text-white">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 pt-8 sm:pt-12">
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

        <div className="mt-8 flex-1">
          <section className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-neutral-900 p-6 shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">Run Summary</h2>
              {runData === undefined && (
                <span className="text-sm text-gray-400">Loading…</span>
              )}
            </div>

            {runData === undefined ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[0, 1, 2, 3].map((key) => (
                  <div
                    key={key}
                    className="h-24 rounded-xl bg-white/5 p-4 animate-pulse"
                  >
                    <div className="mb-3 h-4 w-1/3 rounded bg-white/10" />
                    <div className="h-6 w-2/3 rounded bg-white/10" />
                  </div>
                ))}
              </div>
            ) : runData === null ? (
              <p className="text-sm text-gray-300">
                We couldn&apos;t find any details about your most recent run. Try
                starting a new run to see summary information here.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Duration
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {derivedStats.durationLabel}
                  </p>
                  {(derivedStats.startLabel || derivedStats.endLabel) && (
                    <p className="mt-2 text-xs text-gray-400">
                      {derivedStats.startLabel ? `Started ${derivedStats.startLabel}` : "Start time unavailable"}
                      <br />
                      {derivedStats.endLabel ? `Ended ${derivedStats.endLabel}` : "End time unavailable"}
                    </p>
                  )}
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Jobs Completed
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {derivedStats.jobsCompleted} / {derivedStats.totalJobs}
                  </p>
                  <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#ff5757] transition-all"
                      style={{
                        width:
                          derivedStats.totalJobs && derivedStats.totalJobs > 0
                            ? `${Math.min(
                                100,
                                Math.round(
                                  (derivedStats.jobsCompleted /
                                    derivedStats.totalJobs) *
                                    100
                                )
                              )}%`
                            : "0%",
                      }}
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Average Time / Job
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {derivedStats.avgPerJob}
                  </p>
                  <p className="mt-2 text-xs text-gray-400">
                    Based on completed jobs during this run.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Next Run
                  </p>
                  {assignmentStatus === "loading" ? (
                    <p className="mt-2 text-sm text-gray-400">Checking…</p>
                  ) : assignmentStatus === "error" ? (
                    <p className="mt-2 text-sm text-red-300">
                      {assignmentError ?? "Unable to load assignments."}
                    </p>
                  ) : nextAssignment ? (
                  <p className="mt-2 text-sm text-gray-200">
                    <span className="font-semibold text-white">
                      {nextAssignment.totalJobs} job
                      {nextAssignment.totalJobs === 1 ? "" : "s"}
                    </span>{" "}
                    {nextAssignment.isToday ? (
                      "remaining today."
                    ) : (
                      <>
                        awaiting on {nextAssignment.dateParts.weekday},
                        {" "}
                        {nextAssignment.dateParts.month}{" "}
                        {nextAssignment.dateParts.day}
                        <sup>{nextAssignment.dateParts.ordinalSuffix}</sup>.
                      </>
                    )}
                  </p>
                ) : (
                    <p className="mt-2 text-sm text-gray-400">
                      Everything from your roster is wrapped up. No upcoming
                      assignments are waiting for you right now.
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="mt-auto bg-black/95 p-6 backdrop-blur">
        <button
          type="button"
          onClick={() => router.push("/staff/run")}
          className="w-full rounded-lg bg-[#ff5757] px-4 py-2 font-bold text-white transition hover:opacity-90"
        >
          End Run
        </button>
      </div>
    </div>
  );
}

export default function CompletedRunPage() {
  return (
    <MapSettingsProvider>
      <div className="relative flex min-h-screen flex-col bg-black text-white">
        <SettingsDrawer />
        <div className="flex-1 overflow-y-auto min-h-0">
          <CompletedRunContent />
        </div>
      </div>
    </MapSettingsProvider>
  );
}

