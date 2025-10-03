'use client'

import { useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { BoltIcon, CheckIcon, MapIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useClientPortal, computeEtaLabel, type Job } from './ClientPortalProvider'
import { TrackerMap } from './TrackerMap'
import { useRealtimeJobs } from '@/hooks/useRealtimeJobs'

const STATUS_META: Record<Job['status'], { label: string; badgeClassName: string }> = {
  scheduled: {
    label: 'Scheduled',
    badgeClassName: 'border-white/30 bg-white/10 text-white/80',
  },
  en_route: {
    label: 'En route',
    badgeClassName: 'border-binbird-red/60 bg-binbird-red/10 text-binbird-red',
  },
  on_site: {
    label: 'On site',
    badgeClassName: 'border-binbird-red/60 bg-binbird-red/10 text-binbird-red',
  },
  completed: {
    label: 'Completed',
    badgeClassName: 'border-white/40 bg-white/10 text-white',
  },
  skipped: {
    label: 'Skipped',
    badgeClassName: 'border-white/10 bg-white/5 text-white/60',
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

const describeStep = (job: Job, step: (typeof PROGRESS_STEPS)[number]): string | null => {
  switch (step.key) {
    case 'scheduled':
      return format(new Date(job.scheduledAt), 'p')
    case 'en_route':
      if (job.startedAt) {
        return format(new Date(job.startedAt), 'p')
      }
      if (job.status === 'en_route') {
        return computeEtaLabel(job)
      }
      return null
    case 'on_site':
      if (job.status === 'on_site') {
        return 'Crew on site'
      }
      if (job.status === 'completed') {
        return 'Finished up'
      }
      return null
    case 'completed':
      if (job.completedAt) {
        return format(new Date(job.completedAt), 'p')
      }
      if (job.status === 'skipped') {
        return 'Skipped'
      }
      return job.status === 'completed' ? 'Wrapped' : null
    default:
      return null
  }
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
                <article
                  key={job.id}
                  className="rounded-3xl border border-white/10 bg-gradient-to-br from-black/60 via-black/40 to-black/20 p-6 shadow-[0_30px_60px_-40px_rgba(255,87,87,0.75)]"
                >
                  <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-5">
                      <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-wide">
                        <span
                          className={clsx(
                            'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-semibold transition-all',
                            status.badgeClassName,
                          )}
                        >
                          <span className="h-2 w-2 rounded-full bg-binbird-red shadow-[0_0_12px_rgba(255,87,87,0.6)]" />
                          {status.label}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-white/70">
                          {computeEtaLabel(job)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Address</p>
                        <h3 className="text-2xl font-semibold text-white">{job.propertyName}</h3>
                        <p className="text-sm text-white/70">{formatJobDetail(job)}</p>
                      </div>
                      <dl className="grid gap-3 text-sm text-white/70 sm:grid-cols-2">
                        <div className="flex items-center gap-2">
                          <dt className="flex items-center gap-2 text-white/50">
                            <MapIcon className="h-5 w-5" />
                            <span>Scheduled</span>
                          </dt>
                          <dd className="font-medium text-white">
                            {format(new Date(job.scheduledAt), 'p')}
                          </dd>
                        </div>
                        {job.crewName ? (
                          <div className="flex items-center gap-2">
                            <dt className="text-white/50">Crew</dt>
                            <dd className="font-medium text-white">{job.crewName}</dd>
                          </div>
                        ) : null}
                        {job.startedAt ? (
                          <div className="flex items-center gap-2">
                            <dt className="text-white/50">Started</dt>
                            <dd className="font-medium text-white">{format(new Date(job.startedAt), 'p')}</dd>
                          </div>
                        ) : null}
                        {job.completedAt ? (
                          <div className="flex items-center gap-2">
                            <dt className="text-white/50">Completed</dt>
                            <dd className="font-medium text-white">{format(new Date(job.completedAt), 'p')}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                    <div className="relative flex flex-col gap-6">
                      <ol className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-0">
                        {PROGRESS_STEPS.map((step, index) => {
                          const reached = progressIndex >= index
                          const completed =
                            progressIndex > index || (progressIndex === index && step.key === 'completed' && !isSkipped)
                          const isCurrent = progressIndex === index
                          const label = step.key === 'completed' && isSkipped ? 'Skipped' : step.label
                          const stepDescription = describeStep(job, step)
                          return (
                            <li key={step.key} className="relative flex flex-1 flex-col sm:flex-row sm:items-center">
                              <div className="flex items-center gap-4 sm:flex-col sm:text-center">
                                <span
                                  className={clsx(
                                    'flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all',
                                    completed
                                      ? 'border-binbird-red bg-binbird-red text-binbird-black shadow-[0_10px_30px_rgba(255,87,87,0.45)]'
                                      : reached
                                        ? 'border-binbird-red text-binbird-red'
                                        : 'border-white/15 text-white/40',
                                    isCurrent && !completed ? 'shadow-[0_0_20px_rgba(255,87,87,0.45)]' : null,
                                  )}
                                >
                                  {completed ? <CheckIcon className="h-6 w-6" /> : index + 1}
                                </span>
                                <div className="flex flex-col text-left sm:text-center">
                                  <span
                                    className={clsx(
                                      'text-xs font-semibold uppercase tracking-wide',
                                      reached ? 'text-white' : 'text-white/40',
                                    )}
                                  >
                                    {label}
                                  </span>
                                  {stepDescription ? (
                                    <span className="text-xs text-white/60">{stepDescription}</span>
                                  ) : null}
                                </div>
                              </div>
                              {index < PROGRESS_STEPS.length - 1 ? (
                                <>
                                  <span
                                    aria-hidden
                                    className={clsx(
                                      'absolute left-6 top-14 h-8 w-px sm:hidden',
                                      progressIndex > index ? 'bg-binbird-red/70' : 'bg-white/15',
                                    )}
                                  />
                                  <div className="ml-16 mt-6 hidden flex-1 sm:ml-4 sm:mt-0 sm:flex" aria-hidden>
                                    <span
                                      className={clsx(
                                        'h-[2px] w-full rounded-full transition-all',
                                        progressIndex > index
                                          ? 'bg-gradient-to-r from-binbird-red/80 via-binbird-red/40 to-white/10'
                                          : 'bg-white/10',
                                      )}
                                    />
                                  </div>
                                </>
                              ) : null}
                            </li>
                          )
                        })}
                      </ol>
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
