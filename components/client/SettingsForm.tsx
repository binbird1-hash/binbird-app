'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { supabase } from '@/lib/supabaseClient'
import { useClientPortal } from './ClientPortalProvider'

export type SettingsFormValues = {
  fullName: string
  phone: string
  companyName: string
  timezone: string
  emergencyContact: string
}

const TIMEZONES = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : ['Australia/Sydney', 'Australia/Melbourne']

export function SettingsForm() {
  const { profile, user, selectedAccount, refreshProperties } = useClientPortal()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
    reset,
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

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return
    await supabase.from('client_profiles').upsert({
      user_id: user.id,
      full_name: values.fullName,
      phone: values.phone,
      company_name: values.companyName,
      timezone: values.timezone,
      emergency_contact: values.emergencyContact,
    })
    await refreshProperties()
  })

  return (
    <form onSubmit={onSubmit} className="space-y-6 text-white">
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
      {selectedAccount && (
        <p className="text-xs text-white/40">
          Changes apply to <strong className="text-white">{selectedAccount.name}</strong>. Contact support to manage billing-level access.
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center gap-2 rounded-full bg-binbird-red px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/40 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Saving…' : isSubmitSuccessful ? 'Saved' : 'Save changes'}
      </button>
    </form>
  )
}
