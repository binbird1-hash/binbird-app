'use client'

import { BillingOverview } from '@/components/client/BillingOverview'

export default function ClientPlanPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Plan</h2>
        <p className="text-sm text-white/60">
          Review your current plan details, invoices, and download copies for your records.
        </p>
      </div>
      <BillingOverview />
    </section>
  )
}
