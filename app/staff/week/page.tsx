"use client";

import { useEffect, useMemo, useState } from "react";
import { MapSettingsProvider } from "@/components/Context/MapSettingsContext";
import SettingsDrawer from "@/components/UI/SettingsDrawer";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { normalizeJobs, type Job } from "@/lib/jobs";
import type { JobRecord } from "@/lib/database.types";
import clsx from "clsx";

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
  put_out: "Put bins out",
  bring_in: "Bring bins in",
};

const JOB_TYPE_STYLES: Record<
  Job["job_type"],
  { background: string; border: string; text: string }
> = {
  put_out: {
    background: "bg-[#ff5757]/15",
    border: "border-[#ff5757]/30",
    text: "text-[#ffb3b3]",
  },
  bring_in: {
    background: "bg-white/10",
    border: "border-white/15",
    text: "text-white/80",
  },
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

function getBinColorStyles(bin: string) {
  const normalized = bin.toLowerCase();
  if (normalized.includes("red")) {
    return {
      background: "bg-red-600",
      border: "border-red-500/70",
      text: "text-white",
    } as const;
  }
  if (normalized.includes("yellow")) {
    return {
      background: "bg-amber-300",
      border: "border-amber-300/70",
      text: "text-black",
    } as const;
  }
  if (normalized.includes("green")) {
    return {
      background: "bg-emerald-600",
      border: "border-emerald-500/70",
      text: "text-white",
    } as const;
  }
  return {
    background: "bg-neutral-800",
    border: "border-neutral-600/70",
    text: "text-white",
  } as const;
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
                        <span
                          className={clsx(
                            "inline-flex h-8 items-center justify-center rounded-full border px-4 text-[11px] font-semibold uppercase tracking-[0.18em]",
                            JOB_TYPE_STYLES[job.job_type].background,
                            JOB_TYPE_STYLES[job.job_type].border,
                            JOB_TYPE_STYLES[job.job_type].text
                          )}
                        >
                          {JOB_TYPE_LABELS[job.job_type]}
                        </span>
                        {parsedBins.length ? (
                          parsedBins.map((bin, idx) => {
                            const styles = getBinColorStyles(bin);
                            return (
                              <span
                                key={`${job.id}-bin-${idx}`}
                                className={clsx(
                                  "inline-flex h-8 min-w-[96px] items-center justify-center rounded-full border px-4 text-[11px] font-semibold uppercase tracking-wide",
                                  styles.background,
                                  styles.text,
                                  styles.border
                                )}
                              >
                                {bin}
                              </span>
                            );
                          })
                        ) : (
                          <span className="inline-flex h-8 items-center justify-center rounded-full border border-white/10 bg-black/50 px-4 text-[11px] font-semibold uppercase tracking-wide text-white/70">
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
