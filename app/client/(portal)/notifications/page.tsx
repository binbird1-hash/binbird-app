'use client'

import { NotificationPreferencesForm } from '@/components/client/NotificationPreferencesForm'

export default function ClientNotificationsPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-binbird-red">Notifications</p>
        <h1 className="text-3xl font-bold text-slate-900">Stay in the loop</h1>
        <p className="text-slate-600">
          Choose how you receive updates about crew movements and proof-of-service uploads for each account.
        </p>
      </div>

      <NotificationPreferencesForm />
    </section>
  )
}
