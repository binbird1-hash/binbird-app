'use client'

import { useCallback, useMemo } from 'react'
import { BoltIcon, CheckIcon, ClockIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { BIN_THEME, DEFAULT_BIN_PILL, type BinThemeKey } from './binThemes'
import { useClientPortal, type Job, type Property } from './ClientPortalProvider'
import { TrackerMap } from './TrackerMap'
import { useRealtimeJobs } from '@/hooks/useRealtimeJobs'
import { useSupabase } from '@/components/providers/SupabaseProvider'

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

const PROGRESS_DESCRIPTIONS: Record<Exclude<Job['status'], 'skipped'>, string> = {
  scheduled: 'Queued and waiting for your service window.',
  en_route: 'Our crew has left the depot and is on the way.',
  on_site: 'The team is actively servicing this property.',
  completed: 'Service is wrapped up and logged for your records.',
}

const SKIPPED_DESCRIPTION = 'This visit was skipped by the crew.'

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

const formatScheduledLabel = (value: string | null | undefined): string | null => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
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

  const activeJobs = useMemo(
    () => jobs.filter((job) => job.status !== 'completed'),
    [jobs],
  )

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
              const progressIndex = PROGRESS_INDEX[job.status]
              const isSkipped = job.status === 'skipped'
              const property = job.propertyId ? propertiesById.get(job.propertyId) ?? null : null
              const fullAddress = formatPropertyAddress(property ?? null, job.propertyName)
              const jobTypeLabel = formatJobTypeLabel(job.jobType)
              const scheduledLabel = formatScheduledLabel(job.scheduledAt)
              const bins = job.bins && job.bins.length > 0 ? job.bins : []
              const currentStep = PROGRESS_STEPS[Math.min(progressIndex, PROGRESS_STEPS.length - 1)]
              const statusLabel = isSkipped
                ? 'Skipped'
                : currentStep
                  ? currentStep.label
                  : PROGRESS_STEPS[0]!.label
              const statusDescription = isSkipped
                ? SKIPPED_DESCRIPTION
                : currentStep
                  ? PROGRESS_DESCRIPTIONS[currentStep.key]
                  : PROGRESS_DESCRIPTIONS.scheduled
              const showCheckmark = !isSkipped && job.status === 'completed'
              const statusBadgeValue = isSkipped ? '!' : progressIndex + 1
              return (
                <article
                  key={job.id}
                  className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-[0_10px_45px_-20px_rgba(0,0,0,0.8)]"
                >
                  <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-5">
                        <div className="space-y-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Property</span>
                          <h3 className="text-2xl font-semibold text-white">{fullAddress}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
                          {jobTypeLabel ? (
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/90 shadow-[0_0_0_1px_rgba(255,255,255,0.05)] sm:text-sm">
                              {jobTypeLabel}
                            </span>
                          ) : (
                            <span className="text-white/50">Service details coming soon</span>
                          )}
                          {scheduledLabel ? (
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs font-medium text-white/80 backdrop-blur sm:text-sm">
                              <ClockIcon className="h-4 w-4" />
                              {scheduledLabel}
                            </span>
                          ) : null}
                          {job.crewName ? (
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs font-medium text-white/80 backdrop-blur sm:text-sm">
                              <UserGroupIcon className="h-4 w-4" />
                              Crew: <span className="font-semibold text-white">{job.crewName}</span>
                            </span>
                          ) : null}
                        </div>
                        {bins.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {bins.map((bin) => {
                              const { pill } = getBinStyles(bin)
                              return (
                                <span
                                  key={`${job.id}-${bin}`}
                                  className={clsx(
                                    'inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-[0_0_15px_rgba(0,0,0,0.25)] sm:text-sm',
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
                      <div className="flex w-full flex-col gap-4 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-5 text-white shadow-[0_20px_40px_-30px_rgba(0,0,0,0.8)] sm:w-auto sm:max-w-sm">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Current status</span>
                        <div className="flex items-center gap-4">
                          <span
                            className={clsx(
                              'flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-semibold leading-none transition-colors',
                              showCheckmark
                                ? 'border-binbird-red bg-binbird-red text-binbird-black'
                                : 'border-binbird-red/70 text-binbird-red',
                            )}
                          >
                            {showCheckmark ? <CheckIcon className="h-6 w-6" /> : statusBadgeValue}
                          </span>
                          <div className="space-y-1">
                            <p className="text-lg font-semibold text-white">{statusLabel}</p>
                            <p className="text-sm text-white/70">{statusDescription}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <ol className="grid gap-3 sm:grid-cols-4">
                      {PROGRESS_STEPS.map((step, index) => {
                        const reached = progressIndex >= index
                        const completed =
                          progressIndex > index || (!isSkipped && progressIndex === index && step.key === 'completed')
                        const active = progressIndex === index && !isSkipped
                        const label = step.key === 'completed' && isSkipped ? 'Skipped' : step.label
                        const description =
                          step.key === 'completed' && isSkipped
                            ? SKIPPED_DESCRIPTION
                            : PROGRESS_DESCRIPTIONS[step.key]
                        return (
                          <li
                            key={`${job.id}-${step.key}`}
                            className={clsx(
                              'relative flex flex-1 flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-center transition-colors sm:p-5',
                              completed
                                ? 'border-binbird-red/80 bg-binbird-red/10'
                                : reached
                                  ? 'border-binbird-red/40 bg-binbird-red/5'
                                  : 'border-white/10 bg-black/30',
                              index < PROGRESS_STEPS.length - 1 &&
                                "sm:after:absolute sm:after:left-[calc(100%+0.25rem)] sm:after:top-1/2 sm:after:h-[2px] sm:after:w-6 sm:after:-translate-y-1/2 sm:after:content-['']",
                              index < PROGRESS_STEPS.length - 1 &&
                                (progressIndex > index
                                  ? 'sm:after:bg-binbird-red/60'
                                  : 'sm:after:bg-white/15'),
                            )}
                          >
                            <span
                              className={clsx(
                                'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold leading-none transition-colors',
                                completed
                                  ? 'border-binbird-red bg-binbird-red text-binbird-black'
                                  : reached
                                    ? 'border-binbird-red text-binbird-red'
                                    : 'border-white/15 text-white/40',
                              )}
                            >
                              {completed && step.key === 'completed' && !isSkipped ? (
                                <CheckIcon className="h-5 w-5" />
                              ) : (
                                index + 1
                              )}
                            </span>
                            <div className="space-y-1">
                              <p
                                className={clsx(
                                  'text-xs font-semibold uppercase tracking-wide',
                                  reached ? 'text-white' : 'text-white/40',
                                )}
                              >
                                {label}
                              </p>
                              <p
                                className={clsx(
                                  'text-xs leading-relaxed text-white/50 sm:text-sm',
                                  active ? 'text-white/80' : null,
                                )}
                              >
                                {description}
                              </p>
                            </div>
                          </li>
                        )
                      })}
                    </ol>
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
