'use client'

import { useCallback, useMemo } from 'react'
import { BoltIcon, CheckIcon, MapIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
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

const formatJobTypeLabel = (value: string | null | undefined): string | null => {
  if (!value) return null
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const getBinStyles = (bin: string | undefined) => {
  const key = (bin ?? '').toLowerCase()
  if (key.includes('garbage') || key.includes('landfill') || key.includes('red')) {
    return { pill: 'border-red-500/70 bg-red-600 text-white' }
  }
  if (key.includes('recycling') || key.includes('yellow')) {
    return { pill: 'border-amber-300/70 bg-amber-300 text-black' }
  }
  if (key.includes('compost') || key.includes('green') || key.includes('organic')) {
    return { pill: 'border-emerald-500/70 bg-emerald-600 text-white' }
  }
  return { pill: 'border-white/20 bg-white/10 text-white' }
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
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
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

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
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
              const bins = job.bins && job.bins.length > 0 ? job.bins : []
              return (
                <article
                  key={job.id}
                  className="rounded-3xl border border-white/10 bg-gradient-to-br from-black/60 via-black/40 to-black/20 p-6"
                >
                  <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Address</p>
                        <h3 className="text-2xl font-semibold text-white">{fullAddress}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
                          {jobTypeLabel ? (
                            <span className="font-medium text-white/80">{jobTypeLabel}</span>
                          ) : (
                            <span className="text-white/50">Service details coming soon</span>
                          )}
                          {bins.map((bin) => {
                            const { pill } = getBinStyles(bin)
                            return (
                              <span
                                key={`${job.id}-${bin}`}
                                className={clsx(
                                  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide',
                                  pill,
                                )}
                              >
                                {bin}
                              </span>
                            )
                          })}
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
                      <ol className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-0">
                        {PROGRESS_STEPS.map((step, index) => {
                          const reached = progressIndex >= index
                          const completed =
                            progressIndex > index || (progressIndex === index && step.key === 'completed' && !isSkipped)
                          const label = step.key === 'completed' && isSkipped ? 'Skipped' : step.label
                          return (
                            <li key={step.key} className="relative flex flex-1 flex-col sm:flex-row sm:items-center sm:gap-3">
                              <div className="flex items-center gap-4 sm:flex-col sm:text-center">
                                <span
                                  className={clsx(
                                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all',
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
