'use client'

import { NotificationPreferencesForm } from '@/components/client/NotificationPreferencesForm'

export default function ClientNotificationsPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">Notifications</h2>
        <p className="text-sm text-white/60">
          Choose how BinBird keeps you informed about service progress, exceptions, and billing reminders.
        </p>
      </div>
      <NotificationPreferencesForm />
    </section>
  )
}
