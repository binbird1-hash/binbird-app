'use client'

import { useEffect, useState } from 'react'
import { Switch } from '@headlessui/react'
import { BellIcon, InboxIcon, PhoneIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useForm } from 'react-hook-form'
import { useClientPortal } from './ClientPortalProvider'
import { useSupabase } from '@/components/providers/SupabaseProvider'

export type SettingsFormValues = {
  fullName: string
  phone: string
  companyName: string
  timezone: string
  emergencyContact: string
}

type MutablePreferences = {
  emailRouteUpdates: boolean
  pushRouteUpdates: boolean
  emailBilling: boolean
  pushBilling: boolean
  emailPropertyAlerts: boolean
  pushPropertyAlerts: boolean
}

type PreferenceKey = keyof MutablePreferences

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

const TIMEZONES = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : ['Australia/Sydney', 'Australia/Melbourne']

export function SettingsForm() {
  const {
    profile,
    user,
    selectedAccount,
    refreshProperties,
    notificationPreferences,
    preferencesLoading,
    refreshNotificationPreferences,
  } = useClientPortal()
  const supabase = useSupabase()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [preferencesState, setPreferencesState] = useState<MutablePreferences | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
    reset,
    watch,
  } = useForm<SettingsFormValues>({
    defaultValues: {
      fullName: profile?.fullName ?? '',
      phone: profile?.phone ?? '',
      companyName: profile?.companyName ?? '',
      timezone: profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      emergencyContact: '',
    },
  })

  useEffect(() => {
    if (profile) {
      reset({
        fullName: profile.fullName,
        phone: profile.phone ?? '',
        companyName: profile.companyName ?? '',
        timezone: profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        emergencyContact: '',
      })
    }
  }, [profile, reset])

  useEffect(() => {
    if (notificationPreferences) {
      setPreferencesState({
        emailRouteUpdates: notificationPreferences.emailRouteUpdates,
        pushRouteUpdates: notificationPreferences.pushRouteUpdates,
        emailBilling: notificationPreferences.emailBilling,
        pushBilling: notificationPreferences.pushBilling,
        emailPropertyAlerts: notificationPreferences.emailPropertyAlerts,
        pushPropertyAlerts: notificationPreferences.pushPropertyAlerts,
      })
    }
  }, [notificationPreferences])

  useEffect(() => {
    const subscription = watch(() => {
      setStatusMessage(null)
      setSubmitError(null)
    })

    return () => subscription.unsubscribe()
  }, [watch])

  const updatePreference = (key: PreferenceKey, value: boolean) => {
    setStatusMessage(null)
    setSubmitError(null)
    setPreferencesState((current) => (current ? { ...current, [key]: value } : current))
  }

  const onSubmit = handleSubmit(async (values) => {
    if (!user) {
      setSubmitError('You must be signed in to update your settings.')
      throw new Error('Not authenticated')
    }

    setSubmitError(null)
    setStatusMessage(null)

    const { error: upsertError } = await supabase.from('user_profile').upsert({
      user_id: user.id,
      full_name: values.fullName,
      phone: values.phone,
      email: user.email,
      map_style_pref: profile?.timezone ?? null,
      nav_pref: profile?.companyName ?? null,
      created_at: new Date().toISOString(),
      abn: null,
    })

    if (upsertError) {
      setSubmitError(upsertError.message ?? 'Failed to save profile details.')
      throw new Error(upsertError.message ?? 'Failed to save profile details.')
    }

    const metadataUpdate: Record<string, unknown> = {
      full_name: values.fullName,
      phone: values.phone,
      company: values.companyName,
      timezone: values.timezone,
      emergency_contact: values.emergencyContact,
    }

    if (preferencesState && selectedAccount) {
      const existing =
        (user.user_metadata?.notification_preferences as Record<string, Partial<MutablePreferences>> | undefined) ?? {}
      metadataUpdate.notification_preferences = {
        ...existing,
        [selectedAccount.id]: {
          emailRouteUpdates: preferencesState.emailRouteUpdates,
          pushRouteUpdates: preferencesState.pushRouteUpdates,
          emailBilling: preferencesState.emailBilling,
          pushBilling: preferencesState.pushBilling,
          emailPropertyAlerts: preferencesState.emailPropertyAlerts,
          pushPropertyAlerts: preferencesState.pushPropertyAlerts,
        },
      }
    }

    const { error: updateError } = await supabase.auth.updateUser({
      data: metadataUpdate,
    })

    if (updateError) {
      setSubmitError(updateError.message ?? 'Failed to update account settings.')
      throw new Error(updateError.message ?? 'Failed to update account settings.')
    }

    try {
      await refreshProperties()
      if (preferencesState && selectedAccount) {
        await refreshNotificationPreferences()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh account data.'
      setSubmitError(message)
      throw error instanceof Error ? error : new Error(message)
    }

    setStatusMessage('Settings saved successfully.')
  })

  const togglesDisabled = isSubmitting || !selectedAccount

  return (
    <form onSubmit={onSubmit} className="space-y-10 text-white">
      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">Account settings</h2>
          <p className="text-sm text-white/60">
            Update contact details, emergency information, and portal preferences for your team.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-white/60">Full name</span>
            <input
              type="text"
              {...register('fullName', { required: 'Your name is required.' })}
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-white focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            />
            {errors.fullName && <span className="text-xs text-red-300">{errors.fullName.message}</span>}
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-white/60">Phone</span>
            <input
              type="tel"
              {...register('phone')}
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-white focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-white/60">Company</span>
            <input
              type="text"
              {...register('companyName')}
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-white focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-white/60">Timezone</span>
            <select
              {...register('timezone')}
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-white focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            >
              {TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm md:col-span-2">
            <span className="text-white/60">Emergency contact</span>
            <input
              type="text"
              {...register('emergencyContact')}
              placeholder="Name & phone of on-site contact"
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-white focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            />
          </label>
        </div>
      </section>

      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">Notification preferences</h2>
          <p className="text-sm text-white/60">
            Choose how BinBird keeps you informed about service progress, exceptions, and billing reminders.
          </p>
        </div>

        {!preferencesState ? (
          preferencesLoading ? (
            <div className="flex min-h-[160px] items-center justify-center text-white/60">
              <span className="flex items-center gap-3">
                <span className="h-2 w-2 animate-ping rounded-full bg-binbird-red" /> Loading preferences…
              </span>
            </div>
          ) : (
            <p className="text-sm text-white/60">Notification preferences are unavailable for this account.</p>
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {PREFERENCE_FIELDS.map((field) => {
              const Icon = field.icon
              const emailKey = field.key as PreferenceKey
              const pushKey = field.key.replace('email', 'push') as PreferenceKey

              return (
                <section
                  key={field.key}
                  className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-black/30 p-5 shadow-inner shadow-black/30"
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
                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm">
                      <span className="text-white/70">Email</span>
                      <Switch
                        checked={preferencesState[emailKey]}
                        onChange={(value) => updatePreference(emailKey, value)}
                        aria-label={`${field.label} email notifications`}
                        disabled={togglesDisabled}
                        className={clsx(
                          'relative inline-flex h-7 w-12 items-center rounded-full transition',
                          preferencesState[emailKey] ? 'bg-binbird-red' : 'bg-white/20',
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
                    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm">
                      <span className="text-white/70">Push</span>
                      <Switch
                        checked={preferencesState[pushKey]}
                        onChange={(value) => updatePreference(pushKey, value)}
                        aria-label={`${field.label} push notifications`}
                        disabled={togglesDisabled}
                        className={clsx(
                          'relative inline-flex h-7 w-12 items-center rounded-full transition',
                          preferencesState[pushKey] ? 'bg-binbird-red' : 'bg-white/20',
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
          <p className="text-xs text-white/50">Select an account to manage notification preferences.</p>
        )}
      </section>

      {submitError && (
        <p className="text-sm text-red-300" role="alert">
          {submitError}
        </p>
      )}
      {statusMessage && !submitError && (
        <p className="text-sm text-white/70" role="status">
          {statusMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center gap-2 rounded-full bg-binbird-red px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/40 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Saving…' : isSubmitSuccessful ? 'Saved' : 'Save settings'}
      </button>
    </form>
  )
}
