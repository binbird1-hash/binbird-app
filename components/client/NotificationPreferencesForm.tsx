'use client'

import { useEffect, useState } from 'react'
import { Switch } from '@headlessui/react'
import clsx from 'clsx'
import { useClientPortal } from './ClientPortalProvider'
import { PreferenceKey, PREFERENCE_FIELDS, MutablePreferences } from './notificationPreferencesFields'
import { useSupabase } from '@/components/providers/SupabaseProvider'
import { isEmailConfirmed } from '@/lib/auth/isEmailConfirmed'

export function NotificationPreferencesForm() {
  const { user, selectedAccount, notificationPreferences, preferencesLoading, refreshNotificationPreferences } =
    useClientPortal()
  const supabase = useSupabase()
  const [preferencesState, setPreferencesState] = useState<MutablePreferences | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (notificationPreferences) {
      setPreferencesState({
        emailRouteUpdates: notificationPreferences.emailRouteUpdates,
        pushRouteUpdates: notificationPreferences.pushRouteUpdates,
      })
    }
  }, [notificationPreferences])

  const updatePreference = (key: PreferenceKey, value: boolean) => {
    setStatusMessage(null)
    setSubmitError(null)
    setPreferencesState((current) => (current ? { ...current, [key]: value } : current))
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      setSubmitError('You must be signed in to update notifications.')
      return
    }

    if (!isEmailConfirmed(user)) {
      setSubmitError('Please verify your email before updating notifications.')
      return
    }

    if (!preferencesState || !selectedAccount) {
      setSubmitError('Select an account to manage notification preferences.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setStatusMessage(null)

    const existing =
      (user.user_metadata?.notification_preferences as Record<string, Partial<MutablePreferences>> | undefined) ?? {}

    const { error } = await supabase.auth.updateUser({
      data: {
        notification_preferences: {
          ...existing,
          [selectedAccount.id]: {
            emailRouteUpdates: preferencesState.emailRouteUpdates,
            pushRouteUpdates: preferencesState.pushRouteUpdates,
          },
        },
      },
    })

    if (error) {
      setSubmitError(error.message ?? 'Failed to update notification preferences.')
      setIsSubmitting(false)
      return
    }

    await refreshNotificationPreferences()
    setStatusMessage('Notification preferences saved successfully.')
    setIsSubmitting(false)
  }

  const togglesDisabled = isSubmitting || !selectedAccount

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-slate-900">Notification preferences</h2>
        <p className="text-sm text-slate-500">Choose how BinBird keeps you informed about service progress.</p>
      </div>

      {!preferencesState ? (
        preferencesLoading ? (
          <div className="flex min-h-[160px] items-center justify-center text-slate-500">
            <span className="flex items-center gap-3">
              <span className="h-2 w-2 animate-ping rounded-full bg-binbird-red" /> Loading preferences…
            </span>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Notification preferences are unavailable for this account.</p>
        )
      ) : (
        <div className="grid gap-4">
          {PREFERENCE_FIELDS.map((field) => {
            const Icon = field.icon
            const emailKey = field.key as PreferenceKey
            const pushKey = field.key.replace('email', 'push') as PreferenceKey

            return (
              <section key={field.key} className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex items-start gap-3">
                  <span className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-500">
                    <Icon className="h-6 w-6" />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{field.label}</h3>
                    <p className="text-sm text-slate-500">{field.description}</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                    <span className="text-slate-600">Email</span>
                    <Switch
                      checked={preferencesState[emailKey]}
                      onChange={(value) => updatePreference(emailKey, value)}
                      aria-label={`${field.label} email notifications`}
                      disabled={togglesDisabled}
                      className={clsx(
                        'relative inline-flex h-7 w-12 items-center rounded-full transition',
                        preferencesState[emailKey] ? 'bg-binbird-red' : 'bg-slate-200',
                        togglesDisabled && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      <span
                        className={clsx(
                          'inline-block h-5 w-5 transform rounded-full bg-white transition',
                          preferencesState[emailKey] ? 'translate-x-6' : 'translate-x-1',
                        )}
                      />
                    </Switch>
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                    <span className="text-slate-600">Push</span>
                    <Switch
                      checked={preferencesState[pushKey]}
                      onChange={(value) => updatePreference(pushKey, value)}
                      aria-label={`${field.label} push notifications`}
                      disabled={togglesDisabled}
                      className={clsx(
                        'relative inline-flex h-7 w-12 items-center rounded-full transition',
                        preferencesState[pushKey] ? 'bg-binbird-red' : 'bg-slate-200',
                        togglesDisabled && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      <span
                        className={clsx(
                          'inline-block h-5 w-5 transform rounded-full bg-white transition',
                          preferencesState[pushKey] ? 'translate-x-6' : 'translate-x-1',
                        )}
                      />
                    </Switch>
                  </label>
                </div>
              </section>
            )
          })}
        </div>
      )}

      {!selectedAccount && preferencesState && (
        <p className="text-xs text-slate-500">Select an account to manage notification preferences.</p>
      )}

      {submitError && (
        <p className="text-sm text-red-300" role="alert">
          {submitError}
        </p>
      )}
      {statusMessage && !submitError && (
        <p className="text-sm text-slate-600" role="status">
          {statusMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center gap-2 rounded-full bg-binbird-red px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Saving…' : 'Save preferences'}
      </button>
    </form>
  )
}
