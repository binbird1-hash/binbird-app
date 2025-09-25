'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Job } from '@/components/client/ClientPortalProvider'
import { nextDay, setHours, setMinutes, startOfToday } from 'date-fns'
import type { Day } from 'date-fns'

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

export function useRealtimeJobs(accountId: string | null, onChange: (job: Job) => void) {
  useEffect(() => {
    if (!accountId) return

    const channel = supabase
      .channel(`jobs-client-${accountId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs', filter: `client_name=eq.${accountId}` },
        (payload) => {
          const newJob = payload.new as any
          if (!newJob) return
          const scheduledAt = computeNextOccurrence(newJob.day_of_week ?? null)
          const bins = typeof newJob.bins === 'string' ? newJob.bins.split(',').map((value: string) => value.trim()) : []
          const job: Job = {
            id: String(newJob.id),
            accountId,
            propertyId: null,
            propertyName: newJob.address ?? 'Property',
            status: 'scheduled',
            scheduledAt,
            etaMinutes: null,
            startedAt: null,
            completedAt: newJob.last_completed_on ?? null,
            crewName: null,
            proofPhotoKeys: newJob.photo_path ? [newJob.photo_path] : [],
            routePolyline: null,
            lastLatitude: newJob.lat ?? undefined,
            lastLongitude: newJob.lng ?? undefined,
            notes: newJob.notes ?? null,
            jobType: newJob.job_type ?? null,
            bins,
          }
          onChange(job)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [accountId, onChange])
}
