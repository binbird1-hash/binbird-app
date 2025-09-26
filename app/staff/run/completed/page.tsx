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
        
        // 1️⃣ Check for jobs today
        const todayJobs = jobsByDay.get(todayName);
        if (todayJobs && todayJobs.length > 0) {
          const [primary] = todayJobs;
          found = {
            day: "Today",
            address: primary.address,
            clientName: typeof primary.clientName === "string" ? primary.clientName : null,
            totalJobs: todayJobs.length,
          };
        } else {
          // 2️⃣ Otherwise, look ahead for the next day with jobs
          for (let offset = 1; offset <= WEEKDAYS.length; offset += 1) {
            const idx = (startIndex + offset) % WEEKDAYS.length;
            const dayName = WEEKDAYS[idx];
            const jobsForDay = jobsByDay.get(dayName);
            if (jobsForDay && jobsForDay.length > 0) {
              const [primary] = jobsForDay;
              found = {
                day: dayName,
                address: primary.address,
                clientName: typeof primary.clientName === "string" ? primary.clientName : null,
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
    <div className="flex min-h-screen flex-col bg-black text-white">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 pb-40 pt-12">
        <div className="relative mb-8 text-center sm:text-left">
          <div
            className="absolute left-0 top-0 w-screen bg-[#ff5757]"
            style={{ height: "2px" }}
          />
          <div className="space-y-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#ff5757]">
              Run Complete!
            </h1>
            <p className="text-base text-gray-200 sm:text-lg">
              <span className="block">Nice work there.</span>
              <span className="block">
                Here&apos;s a quick recap of your shift.
              </span>
            </p>
          </div>
        </div>

        <section className="flex flex-1 flex-col gap-4 rounded-2xl border border-white/10 bg-neutral-950/70 p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-white">Run Summary</h2>
            {runData === undefined && (
              <span className="text-sm text-gray-400">Loading…</span>
            )}
          </div>

          {runData === undefined ? (
            <p className="text-sm text-gray-300">
              Hang tight while we gather the final numbers.
            </p>
          ) : runData === null ? (
            <p className="text-sm text-gray-300">
              We couldn&apos;t find run details for this session, but your proofs
              were saved successfully.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-black/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                    Duration
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {derivedStats.durationLabel}
                  </p>
                </div>

                <div className="rounded-xl bg-black/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                    Jobs completed
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
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

                <div className="rounded-xl bg-black/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                    Avg per job
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {derivedStats.avgPerJob}
                  </p>
                </div>

                <div className="rounded-xl bg-black/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                    Started
                  </p>
                  <p className="mt-2 text-sm text-gray-300">
                    {derivedStats.startLabel ?? "—"}
                  </p>
                </div>

                <div className="rounded-xl bg-black/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                    Wrapped up
                  </p>
                  <p className="mt-2 text-sm text-gray-300">
                    {derivedStats.endLabel ?? "—"}
                  </p>
                </div>

                <div className="rounded-xl bg-black/50 p-4 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                    Next run
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    {assignmentStatus === "loading"
                      ? "Loading…"
                      : assignmentStatus === "error"
                      ? assignmentError
                      : nextAssignment
                      ? nextAssignment.day === "Today"
                        ? `${nextAssignment.totalJobs} job${nextAssignment.totalJobs === 1 ? "" : "s"} left today`
                        : `${nextAssignment.totalJobs} job${
                            nextAssignment.totalJobs === 1 ? "" : "s"
                          } on ${nextAssignment.day}, ${new Date().toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
        <div className="bg-black">
          <div className="mx-auto w-full max-w-xl px-6 pb-6 pt-4">
            <div className="relative">
              <div
                className="absolute left-0 top-0 w-screen bg-[#ff5757]"
                style={{ height: "2px" }}
              />
              <button
                type="button"
                onClick={() => router.push("/staff/run")}
                className="pointer-events-auto w-full rounded-lg bg-[#ff5757] px-4 py-3 font-bold text-white transition hover:opacity-90"
              >
                End Run
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CompletedRunPage() {
  return (
    <MapSettingsProvider>
      <div className="relative min-h-screen bg-black text-white">
        <SettingsDrawer />
        <CompletedRunContent />
      </div>
    </MapSettingsProvider>
  );
}
