'use client'

import { LiveTracker } from '@/components/client/LiveTracker'

export default function ClientTrackerPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Live route tracking</h2>
        <p className="text-sm text-white/60">
          Monitor today’s services as they progress, with ETA indicators and live map positioning.
        </p>
      </div>
      <LiveTracker />
    </section>
  )
}
