"use client"

import { useEffect } from "react"
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js"
import type { Job } from "@/components/client/ClientPortalProvider"
import { normaliseBinList } from "@/lib/binLabels"
import { nextDay, setHours, setMinutes, startOfToday } from "date-fns"
import type { Day } from "date-fns"

const WEEKDAY_LOOKUP: Record<string, Day> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

const computeNextOccurrence = (dayOfWeek: string | null): string => {
  if (!dayOfWeek) return new Date().toISOString()
  const key = dayOfWeek.trim().replace(/,/g, '').toLowerCase()
  const weekday = WEEKDAY_LOOKUP[key]
  if (weekday === undefined) return new Date().toISOString()
  const today = startOfToday()
  const scheduled = today.getDay() === weekday ? today : nextDay(today, weekday)
  const withHour = setMinutes(setHours(scheduled, 9), 0)
  return withHour.toISOString()
}

const normaliseId = (value: string | number | null | undefined): string | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return String(value)
  }
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const parseDateToIso = (value: string | null | undefined): string | null => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

const JOB_STATUS_VALUES: Job['status'][] = ['scheduled', 'en_route', 'on_site', 'completed', 'skipped']
const JOB_STATUS_SET = new Set<Job['status']>(JOB_STATUS_VALUES)

const parseStatus = (value: unknown, completedAt: string | null): Job['status'] => {
  if (typeof value === 'string') {
    const normalised = value.trim().toLowerCase() as Job['status']
    if (JOB_STATUS_SET.has(normalised)) {
      if (normalised === 'skipped') {
        return 'skipped'
      }
      if (normalised === 'completed') {
        return 'completed'
      }
      if (completedAt) {
        return 'completed'
      }
      return normalised
    }
  }
  return completedAt ? 'completed' : 'scheduled'
}

const createJobFromPayload = (payload: any, fallbackAccountId: string | null): Job | null => {
  if (!payload) return null
  const scheduledAt = computeNextOccurrence(payload.day_of_week ?? null)
  const bins = normaliseBinList(payload.bins)
  const propertyId = normaliseId(payload.property_id)
  const accountId = normaliseId(payload.account_id) ?? fallbackAccountId ?? 'unknown'
  const completedAt = parseDateToIso(payload.last_completed_on)
  const status = parseStatus(payload.status, completedAt)
  return {
    id: String(payload.id),
    accountId,
    propertyId,
    propertyName: payload.address ?? 'Property',
    status,
    scheduledAt,
    etaMinutes: null,
    startedAt: null,
    completedAt,
    crewName: null,
    proofPhotoKeys: payload.photo_path ? [payload.photo_path] : [],
    routePolyline: null,
    lastLatitude: payload.lat ?? undefined,
    lastLongitude: payload.lng ?? undefined,
    notes: payload.notes ?? null,
    jobType: payload.job_type ?? null,
    bins,
  }
}

export function useRealtimeJobs(
  supabase: SupabaseClient,
  accountId: string | null,
  propertyIds: string[],
  onChange: (job: Job) => void,
) {
  useEffect(() => {
    const uniquePropertyIds = Array.from(
      new Set(
        propertyIds
          .map((value) => normaliseId(value))
          .filter((value): value is string => Boolean(value)),
      ),
    )

    if (!accountId && uniquePropertyIds.length === 0) {
      return
    }

    const channels: RealtimeChannel[] = []

    const handleChange = (payload: { new: any }) => {
      const job = createJobFromPayload(payload.new, accountId)
      if (job) {
        onChange(job)
      }
    }

    if (accountId) {
      const channel = supabase
        .channel(`jobs-client-account-${accountId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'jobs', filter: `account_id=eq.${accountId}` },
          handleChange,
        )
        .subscribe()
      channels.push(channel)
    }

    uniquePropertyIds.forEach((propertyId) => {
      const channel = supabase
        .channel(`jobs-client-property-${propertyId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'jobs', filter: `property_id=eq.${propertyId}` },
          handleChange,
        )
        .subscribe()
      channels.push(channel)
    })

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel)
      })
    }
  }, [accountId, onChange, propertyIds, supabase])
}
