'use client'

import { useSearchParams } from 'next/navigation'
import { useClientPortal } from '@/components/client/ClientPortalProvider'
import { JobHistoryTable } from '@/components/client/JobHistoryTable'

export default function ClientHistoryPage() {
  const { jobHistory, properties, jobsLoading } = useClientPortal()
  const searchParams = useSearchParams()
  const initialPropertyId = searchParams.get('propertyId')

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-slate-900">Job history</h2>
        <p className="text-sm text-slate-500">
          View the last 60 days of service events and access proof-of-service photos.
        </p>
      </div>
      {jobsLoading ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-3xl border border-slate-200 bg-slate-100 text-slate-500">
          <span className="flex items-center gap-3">
            <span className="h-2 w-2 animate-ping rounded-full bg-binbird-red" /> Loading job history…
          </span>
        </div>
      ) : (
        <JobHistoryTable jobs={jobHistory} properties={properties} initialPropertyId={initialPropertyId} />
      )}
    </section>
  )
}
