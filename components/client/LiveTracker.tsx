'use client'

import { useCallback, useMemo } from 'react'
import { BoltIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useClientPortal, type Job } from './ClientPortalProvider'
import { TrackerMap } from './TrackerMap'
import { useRealtimeJobs } from '@/hooks/useRealtimeJobs'

const STATUS_META: Record<Job['status'], { label: string; badgeClassName: string }> = {
  scheduled: {
    label: 'Scheduled',
    badgeClassName: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  },
  en_route: {
    label: 'En route',
    badgeClassName: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  },
  on_site: {
    label: 'On site',
    badgeClassName: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  },
  completed: {
    label: 'Completed',
    badgeClassName: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  },
  skipped: {
    label: 'Skipped',
    badgeClassName: 'border-slate-500/30 bg-slate-500/10 text-slate-200',
  },
}

const PROGRESS_STEPS: { key: Exclude<Job['status'], 'skipped'>; label: string }[] = [
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'en_route', label: 'En route' },
  { key: 'on_site', label: 'On site' },
  { key: 'completed', label: 'Completed' },
]

const PROGRESS_INDEX: Record<Job['status'], number> = {
  scheduled: 0,
  en_route: 1,
  on_site: 2,
  completed: 3,
  skipped: 3,
}

const formatJobDetail = (job: Job): string => {
  const bins = job.bins && job.bins.length > 0 ? job.bins.join(', ') : null
  const jobType = job.jobType
    ? job.jobType
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : null

  if (jobType && bins) {
    return `${jobType}: ${bins}`
  }

  if (jobType) {
    return jobType
  }

  if (bins) {
    return `Bins: ${bins}`
  }

  return 'Service details coming soon'
}

export function LiveTracker() {
  const {
    jobs,
    properties,
    selectedAccount,
    upsertJob,
    refreshJobs,
    refreshProperties,
    jobsLoading,
  } = useClientPortal()

  const activeJobs = useMemo(
    () => jobs.filter((job) => job.status !== 'completed'),
    [jobs],
  )

  const realtimePropertyIds = useMemo(
    () =>
      Array.from(
        new Set(
          properties
            .map((property) => property.id)
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    [properties],
  )

  useRealtimeJobs(selectedAccount?.id ?? null, realtimePropertyIds, (job) => {
    upsertJob(job)
  })

  const todaysJobs = useMemo(
    () =>
      activeJobs.filter((job) => {
        const scheduled = new Date(job.scheduledAt)
        const now = new Date()
        return scheduled.toDateString() === now.toDateString()
      }),
    [activeJobs],
  )

  const handleRefresh = useCallback(async () => {
    await Promise.all([refreshProperties(), refreshJobs()])
  }, [refreshJobs, refreshProperties])

  return (
    <div className="space-y-6 text-white">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-inner shadow-black/30">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Property map</h3>
            <p className="text-sm text-white/60">Explore every location we service for your account.</p>
          </div>
        </header>
        <div className="mt-6">
          <TrackerMap properties={properties} />
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-inner shadow-black/30">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm text-white/60">
            <UserGroupIcon className="h-5 w-5" />
            {todaysJobs.length} active job{todaysJobs.length === 1 ? '' : 's'} today
          </div>
          <button
            type="button"
            onClick={() => {
              void handleRefresh()
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-binbird-red hover:text-white"
          >
            <BoltIcon className="h-5 w-5" /> Refresh data
          </button>
        </header>
        {jobsLoading ? (
          <div className="flex min-h-[160px] items-center justify-center text-white/60">
            <span className="flex items-center gap-3">
              <span className="h-2 w-2 animate-ping rounded-full bg-binbird-red" />
              Loading active jobs…
            </span>
          </div>
        ) : todaysJobs.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-white/20 bg-black/40 px-6 py-12 text-center text-white/60">
            <h4 className="text-lg font-semibold text-white">No active jobs today</h4>
            <p className="mt-2 text-sm">We’ll list your next service here once the crew is on the schedule.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {todaysJobs.map((job) => {
              const status = STATUS_META[job.status]
              const progressIndex = PROGRESS_INDEX[job.status]
              const isSkipped = job.status === 'skipped'
              return (
                <article key={job.id} className="rounded-3xl border border-white/10 bg-black/50 p-5">
                  <div className="flex flex-col gap-6 md:flex-row md:justify-between">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm uppercase tracking-wide text-white/50">Address</p>
                        <h3 className="text-xl font-semibold text-white">{job.propertyName}</h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide',
                            status.badgeClassName,
                          )}
                        >
                          {status.label}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-wide text-white/70">
                          {formatJobDetail(job)}
                        </span>
                      </div>
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:min-w-[220px]">
                      {PROGRESS_STEPS.map((step, index) => {
                        const reached = progressIndex >= index
                        const isCurrent = progressIndex === index
                        const label = step.key === 'completed' && isSkipped ? 'Skipped' : step.label
                        return (
                          <span
                            key={step.key}
                            className={clsx(
                              'rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition',
                              isCurrent
                                ? 'border-white bg-white/10 text-white'
                                : reached
                                  ? 'border-white/60 text-white/80'
                                  : 'border-white/20 text-white/40',
                            )}
                          >
                            {label}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
