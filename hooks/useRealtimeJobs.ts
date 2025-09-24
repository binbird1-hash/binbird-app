'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Job } from '@/components/client/ClientPortalProvider'

export function useRealtimeJobs(accountId: string | null, onChange: (job: Job) => void) {
  useEffect(() => {
    if (!accountId) return

    const channel = supabase
      .channel(`jobs-account-${accountId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `account_id=eq.${accountId}` }, (payload) => {
        const newJob = payload.new as any
        const job: Job = {
          id: String(newJob.id),
          accountId: String(newJob.account_id ?? accountId),
          propertyId: String(newJob.property_id),
          propertyName: newJob.property_name ?? 'Unknown property',
          status: newJob.status,
          scheduledAt: newJob.scheduled_at,
          etaMinutes: newJob.eta_minutes,
          startedAt: newJob.started_at,
          completedAt: newJob.completed_at,
          crewName: newJob.crew_name,
          proofPhotoKeys: newJob.proof_photo_keys ?? [],
          routePolyline: newJob.route_polyline,
          lastLatitude: newJob.last_latitude,
          lastLongitude: newJob.last_longitude,
          notes: newJob.notes,
        }
        onChange(job)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [accountId, onChange])
}
