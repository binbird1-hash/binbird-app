'use client'

import { BillingOverview } from '@/components/client/BillingOverview'

export default function ClientBillingPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Billing & plan</h2>
        <p className="text-sm text-white/60">
          Review your current service plan, invoices, and download copies for your records.
        </p>
      </div>
      <BillingOverview />
    </section>
  )
}
