"use client";

import { useEffect, useMemo, useState } from "react";
import { MapSettingsProvider } from "@/components/Context/MapSettingsContext";
import SettingsDrawer from "@/components/UI/SettingsDrawer";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { normalizeJobs, type Job } from "@/lib/jobs";
import type { JobRecord } from "@/lib/database.types";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const JOB_TYPE_LABELS: Record<Job["job_type"], string> = {
  put_out: "Put Out",
  bring_in: "Bring In",
};

type DayBucket = {
  label: string;
  jobs: Job[];
};

type LoadState = "idle" | "loading" | "error" | "ready";

function getParsedBins(bins: Job["bins"]) {
  if (!bins) return [] as string[];
  return bins
    .split(",")
    .map((bin) => bin.trim())
    .filter(Boolean);
}

function getBinTextClass(bin: string) {
  const normalized = bin.toLowerCase();

  if (normalized.includes("red")) return "text-red-400";
  if (normalized.includes("yellow")) return "text-amber-300";
  if (normalized.includes("green")) return "text-emerald-400";

  return "text-white/70";
}

function WeeklyJobsContent() {
  const supabase = useSupabase();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadWeeklyJobs() {
      try {
        setState("loading");
        setErrorMessage(null);

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user) {
          if (!isActive) return;
          setState("error");
          setErrorMessage("Sign in to see your upcoming jobs.");
          setJobs([]);
          return;
        }

        const { data, error } = await supabase
          .from("jobs")
          .select(
            "id, account_id, property_id, address, lat, lng, job_type, bins, notes, client_name, photo_path, last_completed_on, assigned_to, day_of_week"
          )
          .eq("assigned_to", user.id)
          .is("last_completed_on", null);

        if (error) throw error;

        const normalized = normalizeJobs<JobRecord>(data ?? []);

        if (!isActive) return;
        setJobs(normalized);
        setState("ready");
      } catch (err) {
        console.error("Failed to load weekly jobs", err);
        if (!isActive) return;
        setState("error");
        setErrorMessage("We couldn’t load your weekly jobs. Pull down to refresh.");
        setJobs([]);
      }
    }

    loadWeeklyJobs();

    return () => {
      isActive = false;
    };
  }, [supabase]);

  const groupedByDay = useMemo(() => {
    const dayMap = new Map<string, Job[]>(
      WEEKDAYS.map((day) => [day, [] as Job[]])
    );

    const extras = new Map<string, Job[]>();
    const unscheduled: Job[] = [];

    jobs.forEach((job) => {
      const rawDay = typeof job.day_of_week === "string" ? job.day_of_week.trim() : "";
      if (!rawDay) {
        unscheduled.push(job);
        return;
      }

      const canonical = WEEKDAYS.find(
        (weekday) => weekday.toLowerCase() === rawDay.toLowerCase()
      );

      if (canonical) {
        dayMap.get(canonical)!.push(job);
        return;
      }

      const fallback = WEEKDAYS.find(
        (weekday) => weekday.slice(0, 3).toLowerCase() === rawDay.slice(0, 3).toLowerCase()
      );

      if (fallback) {
        dayMap.get(fallback)!.push(job);
        return;
      }

      const list = extras.get(rawDay) ?? [];
      list.push(job);
      extras.set(rawDay, list);
    });

    const baseBuckets: DayBucket[] = WEEKDAYS.map((day) => ({
      label: day,
      jobs: dayMap.get(day) ?? [],
    }));

    const extraBuckets: DayBucket[] = Array.from(extras.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, list]) => ({
        label,
        jobs: list,
      }));

    if (unscheduled.length) {
      extraBuckets.push({
        label: "Unscheduled",
        jobs: unscheduled,
      });
    }

    return [...baseBuckets, ...extraBuckets];
  }, [jobs]);

  const totalJobs = jobs.length;

  const isLoading = state === "loading" || state === "idle";

  return (
    <div className="flex-1 overflow-y-auto px-5 pb-24 pt-20">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="space-y-3 text-left">
          <h1 className="text-3xl font-bold">This Week’s Jobs</h1>
          <p className="text-sm text-white/70">
            {isLoading
              ? "Loading your weekly assignments…"
              : totalJobs === 0
              ? "No jobs left for the rest of this week."
              : `You have ${totalJobs} job${totalJobs === 1 ? "" : "s"} remaining this week.`}
          </p>
        </header>

        {state === "error" && errorMessage && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        {groupedByDay.map((bucket) => (
          <section
            key={bucket.label}
            className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
          >
            <header className="flex items-center justify-between bg-white/5 px-4 py-3 sm:px-5">
              <div className="text-lg font-semibold tracking-wide uppercase">
                {bucket.label}
              </div>
              <div className="text-sm font-medium text-white/70">
                {bucket.jobs.length === 0
                  ? "No jobs"
                  : `${bucket.jobs.length} job${bucket.jobs.length === 1 ? "" : "s"}`}
              </div>
            </header>

            {bucket.jobs.length === 0 ? (
              <div className="px-4 py-5 text-sm text-white/60 sm:px-5">
                Enjoy the downtime — you’re clear for this day.
              </div>
            ) : (
              <ul className="divide-y divide-white/10">
                {bucket.jobs.map((job) => {
                  const parsedBins = getParsedBins(job.bins);
                  return (
                    <li key={job.id} className="px-4 py-5 sm:px-5">
                      <p className="text-base font-semibold text-white">
                        {job.address || "Address unavailable"}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/70">
                        <span className="text-xs font-semibold uppercase tracking-wide text-white">
                          {JOB_TYPE_LABELS[job.job_type]}
                        </span>
                        {parsedBins.length ? (
                          <span className="text-xs uppercase tracking-wide text-white/70">
                            {parsedBins.map((bin, index) => {
                              const binClass = getBinTextClass(bin);
                              return (
                                <span key={`${job.id}-bin-${index}`} className={binClass}>
                                  {index > 0 && (
                                    <span className="text-white/40">, </span>
                                  )}
                                  {bin}
                                </span>
                              );
                            })}
                          </span>
                        ) : (
                          <span className="text-xs uppercase tracking-wide text-white/50">
                            Bins not specified
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}

        {isLoading && (
          <div className="text-sm text-white/50">Loading latest schedule…</div>
        )}
      </div>
    </div>
  );
}

export default function WeeklyJobsPage() {
  return (
    <MapSettingsProvider>
      <div className="relative flex min-h-screen flex-col bg-black text-white">
        <SettingsDrawer />
        <WeeklyJobsContent />
      </div>
    </MapSettingsProvider>
  );
}
