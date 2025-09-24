"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
    <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-6 pb-10 pt-6 sm:pt-10">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-bold text-[#ff5757]">Run Complete!</h1>
        <p className="text-gray-300">
          <span className="block">Nice work there.</span>
          <span className="block">Here&apos;s a quick recap of your shift.</span>
        </p>
      </header>

      <div className="mt-6 grid flex-1 gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-2xl bg-neutral-900 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-100">Run Summary</h2>
            {runData === undefined && (
              <span className="text-sm text-gray-400">Loading…</span>
            )}
          </div>

          {runData === undefined ? (
            <p className="text-gray-300">
              Hang tight while we gather the final numbers.
            </p>
          ) : runData === null ? (
            <p className="text-gray-300">
              We couldn&apos;t find run details for this session, but your proofs
              were saved successfully.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="divide-y divide-gray-800 text-gray-100">
                <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Duration
                  </p>
                  <p className="text-xl font-semibold text-gray-100">
                    {derivedStats.durationLabel}
                  </p>
                </div>
                <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Jobs completed
                  </p>
                  <p className="text-xl font-semibold text-gray-100">
                    {derivedStats.jobsCompleted ?? "—"}
                    {derivedStats.totalJobs !== undefined &&
                      derivedStats.totalJobs !== derivedStats.jobsCompleted &&
                      derivedStats.totalJobs !== 0 && (
                        <span className="ml-1 text-sm font-medium text-gray-400">
                          / {derivedStats.totalJobs}
                        </span>
                      )}
                  </p>
                </div>
                <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Avg per job
                  </p>
                  <p className="text-xl font-semibold text-gray-100">
                    {derivedStats.avgPerJob}
                  </p>
                </div>
                <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Started
                  </p>
                  <p className="text-sm text-gray-200">
                    {derivedStats.startLabel ?? "—"}
                  </p>
                </div>
                <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Wrapped up
                  </p>
                  <p className="text-sm text-gray-200">
                    {derivedStats.endLabel ?? "—"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="flex flex-col gap-6">
          {/* Next Run Section */}
          <section className="flex flex-col gap-3 rounded-2xl bg-neutral-900 p-5">
            {assignmentStatus === "loading" ? (
              <p className="text-gray-300">Looking up your next shift…</p>
            ) : assignmentStatus === "error" ? (
              <p className="text-gray-300">{assignmentError}</p>
            ) : nextAssignment ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-100">Next Run</h2>

                {/* Bigger + White jobs/date text */}
                <p className="text-xl font-semibold text-white">
                  {nextAssignment.totalJobs} job
                  {nextAssignment.totalJobs === 1 ? "" : "s"} on{" "}
                  {nextAssignment.day},{" "}
                  {new Date().toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            ) : (
              <p className="text-gray-300">Check again next week.</p>
            )}
          </section>

          <button
            type="button"
            onClick={() => router.push("/staff/run")}
            className="w-full rounded-lg bg-[#ff5757] px-4 py-3 font-bold text-white transition hover:opacity-90"
          >
            End Session
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CompletedRunPage() {
  return (
    <MapSettingsProvider>
      <div className="relative min-h-screen overflow-y-auto bg-black text-white pb-6">
        <SettingsDrawer />
        <CompletedRunContent />
      </div>
    </MapSettingsProvider>
  );
}
