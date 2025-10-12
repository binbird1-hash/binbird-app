'use client'

import { NotificationPreferencesForm } from '@/components/client/NotificationPreferencesForm'
import { SettingsForm } from '@/components/client/SettingsForm'

export default function ClientSettingsPage() {
  return (
    <section className="space-y-12">
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">Account settings</h2>
          <p className="text-sm text-white/60">
            Update contact details, emergency information, and portal preferences for your team.
          </p>
        </div>
        <SettingsForm />
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">Notification preferences</h2>
          <p className="text-sm text-white/60">
            Choose how BinBird keeps you informed about service progress, exceptions, and billing reminders.
          </p>
        </div>
        <NotificationPreferencesForm />
      </div>
    </section>
  )
}
