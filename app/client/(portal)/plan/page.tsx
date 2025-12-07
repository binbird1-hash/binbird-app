'use client'

import { BillingOverview } from '@/components/client/BillingOverview'

export default function ClientPlanPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-slate-900">Plan</h2>
        <p className="text-sm text-slate-500">
          Review your current plan details, invoices, and download copies for your records.
        </p>
      </div>
      <BillingOverview />
    </section>
  )
}
