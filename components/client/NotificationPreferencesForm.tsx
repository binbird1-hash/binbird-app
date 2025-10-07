'use client'

import { useEffect, useState } from 'react'
import { Switch } from '@headlessui/react'
import { BellIcon, InboxIcon, PhoneIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useClientPortal } from './ClientPortalProvider'
import { useSupabase } from '@/components/providers/SupabaseProvider'

const PREFERENCE_FIELDS = [
  {
    key: 'emailRouteUpdates',
    label: 'Route updates',
    description: 'Receive notifications when the crew is on their way or arriving on site.',
    icon: BellIcon,
  },
  {
    key: 'emailPropertyAlerts',
    label: 'Property alerts',
    description: 'Get notified when we discover contamination or access issues.',
    icon: InboxIcon,
  },
  {
    key: 'emailBilling',
    label: 'Billing & invoicing',
    description: 'Keep track of billing reminders, invoices, and payment receipts.',
    icon: PhoneIcon,
  },
] as const

type PreferenceKey = (typeof PREFERENCE_FIELDS)[number]['key']

type MutablePreferences = {
  emailRouteUpdates: boolean
  pushRouteUpdates: boolean
  emailBilling: boolean
  pushBilling: boolean
  emailPropertyAlerts: boolean
  pushPropertyAlerts: boolean
}

export function NotificationPreferencesForm() {
  const { notificationPreferences, preferencesLoading, refreshNotificationPreferences, selectedAccount, user } = useClientPortal()
  const supabase = useSupabase()
  const [formState, setFormState] = useState<MutablePreferences | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (notificationPreferences) {
      setFormState({
        emailRouteUpdates: notificationPreferences.emailRouteUpdates,
        pushRouteUpdates: notificationPreferences.pushRouteUpdates,
        emailBilling: notificationPreferences.emailBilling,
        pushBilling: notificationPreferences.pushBilling,
        emailPropertyAlerts: notificationPreferences.emailPropertyAlerts,
        pushPropertyAlerts: notificationPreferences.pushPropertyAlerts,
      })
    }
  }, [notificationPreferences])

  const updateField = (key: PreferenceKey, value: boolean) => {
    setFormState((current) => (current ? { ...current, [key]: value } : current))
  }

  if (!formState) {
    return preferencesLoading ? (
      <div className="flex min-h-[160px] items-center justify-center text-white/60">
        <span className="flex items-center gap-3">
          <span className="h-2 w-2 animate-ping rounded-full bg-binbird-red" /> Loading preferences…
        </span>
      </div>
    ) : null
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedAccount || !user) return
    setSaving(true)
    setMessage(null)

    const existing = (user.user_metadata?.notification_preferences as Record<string, Partial<MutablePreferences>> | undefined) ?? {}
    const updated = {
      ...existing,
      [selectedAccount.id]: {
        emailRouteUpdates: formState.emailRouteUpdates,
        pushRouteUpdates: formState.pushRouteUpdates,
        emailBilling: formState.emailBilling,
        pushBilling: formState.pushBilling,
        emailPropertyAlerts: formState.emailPropertyAlerts,
        pushPropertyAlerts: formState.pushPropertyAlerts,
      },
    }

    let updateError: { message: string } | null = null
    if (user?.id) {
      const { error } = await supabase.auth.updateUser({
        data: {
          notification_preferences: updated,
        },
      })
      updateError = error ? { message: error.message } : null
    } else {
      updateError = { message: 'Not authenticated' }
    }

    if (updateError) {
      setMessage('We could not save your preferences. Please try again or contact support.')
      setSaving(false)
      return
    }

    setMessage('Preferences saved successfully.')
    setSaving(false)
    refreshNotificationPreferences()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {PREFERENCE_FIELDS.map((field) => {
          const Icon = field.icon
          const emailKey = field.key
          const pushKey = field.key.replace('email', 'push') as PreferenceKey
          return (
            <section
              key={field.key}
              className="flex flex-col gap-4 rounded-3xl border border-white/20 bg-black/30 p-5 shadow-inner shadow-black/30"
            >
              <div className="flex items-start gap-3">
                <span className="rounded-2xl border border-white/20 bg-black/40 p-3 text-white/60">
                  <Icon className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-white">{field.label}</h3>
                  <p className="text-sm text-white/60">{field.description}</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm">
                  <span className="text-white/70">Email</span>
                  <Switch
                    checked={formState[emailKey]}
                    onChange={(value) => updateField(emailKey, value)}
                    aria-label={`${field.label} email notifications`}
                    className={clsx(
                      'relative inline-flex h-7 w-12 items-center rounded-full transition',
                      formState[emailKey] ? 'bg-binbird-red' : 'bg-white/20',
                    )}
                  >
                    <span
                      className={clsx(
                        'inline-block h-5 w-5 transform rounded-full bg-white transition',
                        formState[emailKey] ? 'translate-x-6' : 'translate-x-1',
                      )}
                    />
                  </Switch>
                </label>
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-sm">
                  <span className="text-white/70">Push</span>
                  <Switch
                    checked={formState[pushKey]}
                    onChange={(value) => updateField(pushKey, value)}
                    aria-label={`${field.label} push notifications`}
                    className={clsx(
                      'relative inline-flex h-7 w-12 items-center rounded-full transition',
                      formState[pushKey] ? 'bg-binbird-red' : 'bg-white/20',
                    )}
                  >
                    <span
                      className={clsx(
                        'inline-block h-5 w-5 transform rounded-full bg-white transition',
                        formState[pushKey] ? 'translate-x-6' : 'translate-x-1',
                      )}
                    />
                  </Switch>
                </label>
              </div>
            </section>
          )
        })}
      </div>

      {message && <p className="text-sm text-white/70">{message}</p>}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-full bg-binbird-red px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/40 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save preferences'}
      </button>
    </form>
  )
}
