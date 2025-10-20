"use client"

import { useEffect } from "react"
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js"
import type { Job } from "@/components/client/ClientPortalProvider"
import { normaliseBinList } from "@/lib/binLabels"
import {
  parseIsoDateTime,
  parseJobProgressStatus,
  parseOptionalNumber,
  parseStringArray,
} from "@/lib/job-status"
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

const createJobFromPayload = (payload: any, fallbackAccountId: string | null): Job | null => {
  if (!payload) return null
  const scheduledAt = computeNextOccurrence(payload.day_of_week ?? null)
  const bins = normaliseBinList(payload.bins)
  const propertyId = normaliseId(payload.property_id)
  const accountId = normaliseId(payload.account_id) ?? fallbackAccountId ?? 'unknown'
  const completedAt =
    parseIsoDateTime(payload.completed_at ?? payload.completedAt ?? payload.last_completed_on) ?? null
  const startedAt = parseIsoDateTime(payload.started_at ?? payload.startedAt ?? payload.started_on) ?? null
  const arrivedAt = parseIsoDateTime(payload.arrived_at ?? payload.arrivedAt ?? payload.arrived_on) ?? null
  const etaMinutes =
    parseOptionalNumber(payload.eta_minutes ?? payload.etaMinutes ?? payload.eta) ?? null
  const crewName = typeof payload.crew_name === 'string' ? payload.crew_name : null
  const proofKeys = parseStringArray(payload.proof_photo_keys ?? payload.proofPhotoKeys)
  const proofUploadedAt =
    parseIsoDateTime(payload.proof_uploaded_at ?? payload.proofUploadedAt ?? payload.photo_uploaded_at) ?? null
  const rawStatus =
    payload.status ?? payload.progress_status ?? payload.current_status ?? (arrivedAt ? 'on_site' : null)
  const status: Job['status'] = parseJobProgressStatus(rawStatus, {
    completed: Boolean(completedAt),
  })
  const lastLatitude = parseOptionalNumber(
    payload.last_latitude ?? payload.lastLatitude ?? payload.gps_lat ?? payload.lat,
  )
  const lastLongitude = parseOptionalNumber(
    payload.last_longitude ?? payload.lastLongitude ?? payload.gps_lng ?? payload.lng,
  )
  const notes = typeof payload.notes === 'string' ? payload.notes : null
  const jobType = typeof payload.job_type === 'string' ? payload.job_type : null

  return {
    id: String(payload.id),
    accountId,
    propertyId,
    propertyName: payload.address ?? 'Property',
    status,
    scheduledAt,
    etaMinutes,
    startedAt,
    completedAt,
    arrivedAt,
    crewName,
    proofPhotoKeys: [payload.photo_path, ...proofKeys].filter(Boolean) as string[],
    proofUploadedAt,
    routePolyline: payload.route_polyline ?? payload.routePolyline ?? null,
    lastLatitude: lastLatitude ?? undefined,
    lastLongitude: lastLongitude ?? undefined,
    notes,
    jobType,
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
