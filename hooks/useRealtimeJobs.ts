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

const normaliseJobStatus = (value: string | null | undefined): Job['status'] | null => {
  if (!value) return null
  const normalised = value.trim().toLowerCase().replace(/[-\s]/g, '_')
  if (!normalised.length) return null

  switch (normalised) {
    case 'scheduled':
    case 'pending':
      return 'scheduled'
    case 'en_route':
    case 'enroute':
    case 'start':
    case 'started':
    case 'start_run':
    case 'starting':
    case 'departed':
    case 'in_transit':
      return 'en_route'
    case 'on_site':
    case 'onsite':
    case 'arrived':
    case 'arrival':
    case 'arrived_at_location':
    case 'onlocation':
      return 'on_site'
    case 'completed':
    case 'done':
    case 'finished':
    case 'marked_done':
      return 'completed'
    case 'skipped':
    case 'cancelled':
    case 'canceled':
      return 'skipped'
    default:
      return null
  }
}

const extractStatusFromPayload = (payload: Record<string, unknown> | null | undefined): Job['status'] | null => {
  if (!payload) return null
  const candidateKeys = ['status', 'new_status', 'action', 'event', 'type', 'transition']
  for (const key of candidateKeys) {
    if (key in payload) {
      const value = payload[key]
      if (typeof value === 'string') {
        const status = normaliseJobStatus(value)
        if (status) return status
      }
    }
  }
  return null
}

const parseDateToIso = (value: string | null | undefined): string | null => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

const extractProgressTimestamp = (payload: Record<string, unknown> | null | undefined): string | null => {
  if (!payload) return null
  const candidateKeys = ['occurred_at', 'created_at', 'updated_at', 'inserted_at', 'timestamp', 'event_at']
  for (const key of candidateKeys) {
    if (key in payload) {
      const value = payload[key]
      if (typeof value === 'string') {
        const iso = parseDateToIso(value)
        if (iso) return iso
      }
    }
  }
  return null
}

const createJobFromPayload = (payload: any, fallbackAccountId: string | null): (Partial<Job> & { id: string }) | null => {
  if (!payload) return null
  const scheduledAt = computeNextOccurrence(payload.day_of_week ?? null)
  const bins = normaliseBinList(payload.bins)
  const propertyId = normaliseId(payload.property_id)
  const accountId = normaliseId(payload.account_id) ?? fallbackAccountId ?? 'unknown'
  const completedAt =
    parseDateToIso(payload.completed_at ?? null) ?? parseDateToIso(payload.last_completed_on ?? null)
  let startedAt =
    parseDateToIso(payload.started_at ?? null) ?? parseDateToIso(payload.startedAt ?? payload.started_on ?? null)
  let arrivedAt =
    parseDateToIso(payload.arrived_at ?? null) ?? parseDateToIso(payload.arrivedAt ?? payload.arrived_on ?? null)
  const statusFromPayload = extractStatusFromPayload(payload)
  let status: Job['status']
  if (statusFromPayload) {
    status = statusFromPayload
  } else if (completedAt) {
    status = 'completed'
  } else if (arrivedAt) {
    status = 'on_site'
  } else if (startedAt) {
    status = 'en_route'
  } else {
    status = 'scheduled'
  }
  if (status === 'en_route' && !startedAt) {
    startedAt = extractProgressTimestamp(payload)
  }
  if (status === 'on_site' && !arrivedAt) {
    arrivedAt = extractProgressTimestamp(payload)
  }
  const statusUpdatedAt =
    parseDateToIso(payload.status_updated_at ?? payload.last_status_change ?? payload.updated_at ?? null) ??
    extractProgressTimestamp(payload) ??
    completedAt ??
    startedAt ??
    arrivedAt ??
    null
  return {
    id: String(payload.id),
    accountId,
    propertyId,
    propertyName: payload.address ?? 'Property',
    status,
    scheduledAt,
    etaMinutes: null,
    startedAt,
    arrivedAt,
    completedAt,
    crewName: null,
    proofPhotoKeys: payload.photo_path ? [payload.photo_path] : [],
    routePolyline: null,
    lastLatitude: payload.lat ?? undefined,
    lastLongitude: payload.lng ?? undefined,
    notes: payload.notes ?? null,
    jobType: payload.job_type ?? null,
    bins,
    statusUpdatedAt,
  }
}

const createProgressUpdateFromPayload = (
  payload: any,
  fallbackAccountId: string | null,
): (Partial<Job> & { id: string }) | null => {
  if (!payload) return null
  const jobId = normaliseId(payload.job_id ?? payload.jobId ?? payload.job?.id ?? null)
  if (!jobId) return null
  const status = extractStatusFromPayload(payload)
  if (!status) return null
  const occurredAtIso = extractProgressTimestamp(payload)
  const accountId = normaliseId(payload.account_id) ?? fallbackAccountId ?? undefined
  const propertyId = normaliseId(payload.property_id)
  const update: Partial<Job> & { id: string } = {
    id: jobId,
    status,
  }
  if (accountId) {
    update.accountId = accountId
  }
  if (propertyId) {
    update.propertyId = propertyId
  }
  if (status === 'en_route') {
    update.startedAt = occurredAtIso ?? null
  }
  if (status === 'on_site') {
    update.arrivedAt = occurredAtIso ?? null
  }
  if (status === 'completed' || status === 'skipped') {
    update.completedAt = occurredAtIso ?? null
  }
  if (occurredAtIso) {
    update.statusUpdatedAt = occurredAtIso
  }
  return update
}

export function useRealtimeJobs(
  supabase: SupabaseClient,
  accountId: string | null,
  propertyIds: string[],
  onChange: (job: Partial<Job> & { id: string }) => void,
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

    const handleProgressChange = (payload: { new: any; old: any }) => {
      const update = createProgressUpdateFromPayload(payload.new ?? payload.old, accountId)
      if (update) {
        onChange(update)
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

      const progressChannel = supabase
        .channel(`job-progress-account-${accountId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'job_progress_events', filter: `account_id=eq.${accountId}` },
          handleProgressChange,
        )
        .subscribe()
      channels.push(progressChannel)
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

      const progressChannel = supabase
        .channel(`job-progress-property-${propertyId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'job_progress_events', filter: `property_id=eq.${propertyId}` },
          handleProgressChange,
        )
        .subscribe()
      channels.push(progressChannel)
    })

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel)
      })
    }
  }, [accountId, onChange, propertyIds, supabase])
}
