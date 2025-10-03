'use client'

import { useCallback, useMemo } from 'react'
import { format } from 'date-fns'
import { BoltIcon, MapIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useClientPortal, computeEtaLabel, type Job } from './ClientPortalProvider'
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

const STEPS: { key: 'scheduled' | 'en_route' | 'on_site' | 'completed'; label: string; description: string }[] = [
  { key: 'scheduled', label: 'Scheduled', description: 'Collection booked and confirmed.' },
  { key: 'en_route', label: 'En route', description: 'Crew is on the way.' },
  { key: 'on_site', label: 'On site', description: 'Servicing bins now.' },
  { key: 'completed', label: 'Completed', description: 'Job is wrapped up.' },
]

function Stepper({ status }: { status: Job['status'] }) {
  const normalisedStatus =
    status === 'skipped'
      ? 'completed'
      : (STEPS.find((step) => step.key === status)?.key ?? 'scheduled')
  const activeIndex = STEPS.findIndex((step) => step.key === normalisedStatus)

  return (
    <ol className="relative flex w-full flex-col gap-4 md:flex-row md:items-center">
      {STEPS.map((step, index) => {
        const isCompleted = index <= activeIndex
        return (
          <li key={step.key} className="flex flex-1 items-center gap-3">
            <span
              className={clsx(
                'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition',
                isCompleted
                  ? 'border-binbird-red bg-binbird-red text-white shadow-lg shadow-binbird-red/30'
                  : 'border-white/20 text-white/40',
              )}
            >
              {index + 1}
            </span>
            <div>
              <p className={clsx('text-sm font-semibold', isCompleted ? 'text-white' : 'text-white/60')}>{step.label}</p>
              <p className="text-xs text-white/40">{step.description}</p>
            </div>
            {index < STEPS.length - 1 && <div className="hidden flex-1 border-b border-dashed border-white/10 md:block" />}
          </li>
        )
      })}
    </ol>
  )
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
    () => jobs.filter((job) => job.status !== 'completed' && job.status !== 'skipped'),
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
              return (
                <article key={job.id} className="rounded-3xl border border-white/10 bg-black/50 p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-wide text-white/50">{job.propertyName}</p>
                      <h3 className="text-xl font-semibold text-white">{computeEtaLabel(job)}</h3>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/60">
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide',
                            status.badgeClassName,
                          )}
                        >
                          {status.label}
                        </span>
                        {job.jobType ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-wide text-white/70">
                            {job.jobType.replace('_', ' ')}
                          </span>
                        ) : null}
                        {job.bins && job.bins.length > 0 ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-wide text-white/70">
                            {job.bins.join(', ')}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-white/60">
                      <MapIcon className="h-5 w-5" /> Scheduled {format(new Date(job.scheduledAt), 'p')}
                    </div>
                  </div>
                  {job.notes ? (
                    <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">{job.notes}</p>
                  ) : null}
                  <div className="mt-6">
                    <Stepper status={job.status} />
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
