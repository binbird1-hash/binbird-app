'use client'

import { useCallback, useMemo } from 'react'
import { BoltIcon, CheckIcon, MapIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { BIN_THEME, DEFAULT_BIN_PILL, type BinThemeKey } from './binThemes'
import { useClientPortal, type Job, type Property } from './ClientPortalProvider'
import { TrackerMap } from './TrackerMap'
import { useRealtimeJobs } from '@/hooks/useRealtimeJobs'
import { useSupabase } from '@/components/providers/SupabaseProvider'

const PROGRESS_STEPS: { key: Exclude<Job['status'], 'skipped'>; label: string }[] = [
  { key: 'en_route', label: 'En Route' },
  { key: 'on_site', label: 'On Site' },
  { key: 'completed', label: 'Done' },
]

const PROGRESS_INDEX: Record<Job['status'], number> = {
  scheduled: -1,
  en_route: 0,
  on_site: 1,
  completed: 2,
  skipped: 2,
}

const computeProgressStage = (job: Job): number => {
  if (job.status === 'completed' || job.status === 'skipped') {
    return PROGRESS_INDEX.completed
  }

  if (job.status === 'on_site' || job.arrivedAt) {
    return PROGRESS_INDEX.on_site
  }

  if (job.status === 'en_route' || job.startedAt) {
    return PROGRESS_INDEX.en_route
  }

  return -1
}

const formatJobTypeLabel = (value: string | null | undefined): string | null => {
  if (!value) return null
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const getBinThemeKey = (bin: string | undefined): BinThemeKey | null => {
  const key = (bin ?? '').toLowerCase()
  if (key.includes('garbage') || key.includes('landfill') || key.includes('red')) {
    return 'garbage'
  }
  if (key.includes('recycling') || key.includes('yellow')) {
    return 'recycling'
  }
  if (key.includes('compost') || key.includes('green') || key.includes('organic')) {
    return 'compost'
  }
  return null
}

const getBinStyles = (bin: string | undefined) => {
  const themeKey = getBinThemeKey(bin)
  if (!themeKey) {
    return { pill: DEFAULT_BIN_PILL }
  }
  return { pill: BIN_THEME[themeKey].pill }
}

const formatPropertyAddress = (property: Property | null, fallback: string | null) => {
  const parts: string[] = []
  const seen = new Set<string>()
  const register = (value: string | null | undefined) => {
    if (!value) return
    const trimmed = value.trim()
    if (!trimmed) return
    const normalized = trimmed.toLowerCase()
    if (seen.has(normalized)) return
    seen.add(normalized)
    parts.push(trimmed)
  }

  if (property) {
    register(property.addressLine)
    register(property.suburb)
    register(property.city)
  } else if (fallback) {
    register(fallback)
  }

  if (!parts.length && fallback) {
    parts.push(fallback)
  }

  return parts.join(', ')
}

export function LiveTracker() {
  const supabase = useSupabase()
  const {
    jobs,
    properties,
    selectedAccount,
    upsertJob,
    refreshJobs,
    refreshProperties,
    jobsLoading,
  } = useClientPortal()

  const propertiesById = useMemo(
    () => new Map(properties.map((property) => [property.id, property])),
    [properties],
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

  useRealtimeJobs(supabase, selectedAccount?.id ?? null, realtimePropertyIds, (job) => {
    upsertJob(job)
  })

  const todaysJobs = useMemo(() => {
    const now = new Date()
    return jobs.filter((job) => {
      const scheduled = job.scheduledAt ? new Date(job.scheduledAt) : null
      const completed = job.completedAt ? new Date(job.completedAt) : null
      const matchesScheduled = scheduled ? scheduled.toDateString() === now.toDateString() : false
      const matchesCompleted = completed ? completed.toDateString() === now.toDateString() : false
      return matchesScheduled || matchesCompleted
    })
  }, [jobs])

  const handleRefresh = useCallback(async () => {
    await Promise.all([refreshProperties(), refreshJobs()])
  }, [refreshJobs, refreshProperties])

  return (
    <div className="space-y-6 text-white">
      <section className="rounded-3xl border border-white/10 bg-black/30 p-5">
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

      <section className="rounded-3xl border border-white/10 bg-black/30 p-5">
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
              const progressStage = computeProgressStage(job)
              const isSkipped = job.status === 'skipped'
              const property = job.propertyId ? propertiesById.get(job.propertyId) ?? null : null
              const fullAddress = formatPropertyAddress(property ?? null, job.propertyName)
              const jobTypeLabel = formatJobTypeLabel(job.jobType)
              const bins = job.bins && job.bins.length > 0 ? job.bins : []
              return (
                <article
                  key={job.id}
                  className="rounded-3xl border border-white/10 bg-black/30 p-6"
                >
                  <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Address</p>
                        <h3 className="text-2xl font-semibold text-white">{fullAddress}</h3>
                        <div className="flex flex-col gap-3 text-sm text-white/70 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                          {jobTypeLabel ? (
                            <span className="font-medium text-white/80">{jobTypeLabel}</span>
                          ) : (
                            <span className="text-white/50">Service details coming soon</span>
                          )}
                          {bins.length > 0 ? (
                            <div
                              className={clsx(
                                'grid gap-2 text-xs sm:flex sm:flex-wrap sm:items-center sm:gap-2 sm:text-sm',
                                bins.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
                              )}
                            >
                              {bins.map((bin) => {
                                const { pill } = getBinStyles(bin)
                                return (
                                  <span
                                    key={`${job.id}-${bin}`}
                                    className={clsx(
                                      'flex w-full items-center justify-center rounded-2xl border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white sm:w-auto sm:min-w-[140px] sm:px-5 sm:py-3 sm:text-sm',
                                      pill,
                                    )}
                                  >
                                    {bin}
                                  </span>
                                )
                              })}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {job.crewName ? (
                        <dl className="grid gap-3 text-sm text-white/70 sm:grid-cols-2">
                          <div className="flex items-center gap-2">
                            <dt className="flex items-center gap-2 text-white/50">
                              <MapIcon className="h-5 w-5" />
                              <span>Crew</span>
                            </dt>
                            <dd className="font-medium text-white">{job.crewName}</dd>
                          </div>
                        </dl>
                      ) : null}
                    </div>
                    <div className="relative flex flex-col gap-6">
                      <div className="grid grid-cols-2 gap-3 sm:hidden">
                        {PROGRESS_STEPS.map((step, index) => {
                          const reached = progressStage >= index && progressStage >= 0
                          const completed =
                            progressStage > index ||
                            (progressStage === index && step.key === 'completed' && !isSkipped)
                          const label = step.key === 'completed' && isSkipped ? 'Skipped' : step.label
                          return (
                            <div
                              key={`${job.id}-${step.key}-compact`}
                              className={clsx(
                                'flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-left transition-colors',
                                completed
                                  ? 'border-binbird-red/70 bg-binbird-red/10'
                                  : reached
                                    ? 'border-binbird-red/40 bg-binbird-red/5'
                                    : 'border-white/10 bg-black/20',
                              )}
                            >
                              <span
                                className={clsx(
                                'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold',
                                  completed
                                    ? 'border-binbird-red bg-binbird-red text-binbird-black'
                                    : reached
                                      ? 'border-binbird-red text-binbird-red'
                                      : 'border-white/15 text-white/40',
                                )}
                              >
                                {completed ? <CheckIcon className="h-5 w-5" /> : index + 1}
                              </span>
                              <span
                                className={clsx(
                                  'text-xs font-semibold uppercase tracking-wide',
                                  reached ? 'text-white' : 'text-white/50',
                                )}
                              >
                                {label}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      <ol className="relative hidden flex-col gap-6 sm:flex sm:flex-row sm:items-start sm:gap-0">
                        {PROGRESS_STEPS.map((step, index) => {
                          const reached = progressStage >= index && progressStage >= 0
                          const completed =
                            progressStage > index ||
                            (progressStage === index && step.key === 'completed' && !isSkipped)
                          const label = step.key === 'completed' && isSkipped ? 'Skipped' : step.label
                          return (
                            <li key={step.key} className="relative flex flex-1 flex-col sm:flex-row sm:items-center sm:gap-3">
                              <div className="flex items-center gap-4 sm:flex-col sm:text-center">
                                <span
                                  className={clsx(
                                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all',
                                    completed
                                      ? 'border-binbird-red bg-binbird-red text-binbird-black'
                                      : reached
                                        ? 'border-binbird-red text-binbird-red'
                                        : 'border-white/15 text-white/40',
                                  )}
                                >
                                  {completed ? <CheckIcon className="h-6 w-6" /> : index + 1}
                                </span>
                                <div className="flex flex-col text-left sm:text-center">
                                  <span
                                    className={clsx(
                                      'text-xs font-semibold uppercase tracking-wide whitespace-nowrap',
                                      reached ? 'text-white' : 'text-white/40',
                                    )}
                                  >
                                    {label}
                                  </span>
                                </div>
                              </div>
                              {index < PROGRESS_STEPS.length - 1 ? (
                                <>
                                  <div className="ml-16 mt-6 hidden flex-1 sm:ml-4 sm:mt-0 sm:flex" aria-hidden>
                                    <span
                                      className={clsx(
                                        'h-[2px] w-full rounded-full transition-all',
                                        progressStage > index
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
