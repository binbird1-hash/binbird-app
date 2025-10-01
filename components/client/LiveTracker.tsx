'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { BoltIcon, MapIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useClientPortal, computeEtaLabel } from './ClientPortalProvider'
import { TrackerMap } from './TrackerMap'
import { useRealtimeJobs } from '@/hooks/useRealtimeJobs'

const STEPS: { key: 'scheduled' | 'en_route' | 'on_site' | 'completed'; label: string; description: string }[] = [
  { key: 'scheduled', label: 'Scheduled', description: 'Collection booked and confirmed.' },
  { key: 'en_route', label: 'En route', description: 'Crew is on the way.' },
  { key: 'on_site', label: 'On site', description: 'Servicing bins now.' },
  { key: 'completed', label: 'Completed', description: 'Job is wrapped up.' },
]

function Stepper({ status }: { status: typeof STEPS[number]['key'] }) {
  const activeIndex = STEPS.findIndex((step) => step.key === status)

  return (
    <ol className="relative flex w-full flex-col gap-4 md:flex-row md:items-center">
      {STEPS.map((step, index) => {
        const isCompleted = index <= activeIndex
        return (
          <li key={step.key} className="flex flex-1 items-center gap-3">
            <span
              className={clsx(
                'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition',
                isCompleted ? 'border-binbird-red bg-binbird-red text-white' : 'border-white/20 text-white/40',
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
  const { jobs, properties, selectedAccount, upsertJob, refreshJobs, jobsLoading } = useClientPortal()
  const activeJobs = useMemo(() => jobs.filter((job) => job.status !== 'completed' && job.status !== 'skipped'), [jobs])

  useRealtimeJobs(selectedAccount?.id ?? null, (job) => {
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

  return (
    <div className="space-y-6 text-white">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-inner shadow-black/30">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Live service tracker</h3>
            <p className="text-sm text-white/60">Stay close to the crew with live location and progress updates.</p>
          </div>
          <button
            type="button"
            onClick={() => refreshJobs()}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-binbird-red hover:text-white"
          >
            <BoltIcon className="h-5 w-5" /> Refresh now
          </button>
        </header>
        <div className="mt-6">
          <TrackerMap jobs={activeJobs} properties={properties} />
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-inner shadow-black/30">
        <header className="flex items-center gap-3 text-sm text-white/60">
          <UserGroupIcon className="h-5 w-5" />
          {todaysJobs.length} active job{todaysJobs.length === 1 ? '' : 's'} today
        </header>
        {jobsLoading ? (
          <div className="flex min-h-[160px] items-center justify-center text-white/60">
            <span className="flex items-center gap-3">
              <span className="h-2 w-2 animate-ping rounded-full bg-binbird-red" />
              Loading live jobs…
            </span>
          </div>
        ) : todaysJobs.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-white/20 bg-black/40 px-6 py-12 text-center text-white/60">
            <h4 className="text-lg font-semibold text-white">No live jobs yet</h4>
            <p className="mt-2 text-sm">
              Your next service will appear here once the crew begins their route.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {todaysJobs.map((job) => (
              <article key={job.id} className="rounded-3xl border border-white/10 bg-black/50 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-wide text-white/50">{job.propertyName}</p>
                    <h3 className="text-xl font-semibold text-white">{computeEtaLabel(job)}</h3>
                    <p className="text-sm text-white/60">
                      Status: {job.status.replace('_', ' ')}
                      {job.jobType ? ` · ${job.jobType.replace('_', ' ')}` : ''}
                      {job.bins && job.bins.length > 0 ? ` · ${job.bins.join(', ')}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-white/60">
                    <MapIcon className="h-5 w-5" />
                    Updated {format(new Date(job.scheduledAt), 'p')}
                  </div>
                </div>
                <div className="mt-6">
                  <Stepper status={job.status as (typeof STEPS)[number]['key']} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
