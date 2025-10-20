import type { SupabaseClient } from '@supabase/supabase-js'

export type JobProgressStatus = 'scheduled' | 'en_route' | 'on_site' | 'completed' | 'skipped'

const STATUS_NORMALISATION: Record<string, JobProgressStatus> = {
  scheduled: 'scheduled',
  pending: 'scheduled',
  queued: 'scheduled',
  unstarted: 'scheduled',
  en_route: 'en_route',
  enroute: 'en_route',
  travelling: 'en_route',
  transit: 'en_route',
  in_transit: 'en_route',
  inprogress: 'en_route',
  'in-progress': 'en_route',
  in_progress: 'en_route',
  started: 'en_route',
  driving: 'en_route',
  on_site: 'on_site',
  onsite: 'on_site',
  arrived: 'on_site',
  arrived_on_site: 'on_site',
  at_location: 'on_site',
  completed: 'completed',
  done: 'completed',
  finished: 'completed',
  wrapped: 'completed',
  skipped: 'skipped',
  cancelled: 'skipped',
}

export function parseJobProgressStatus(
  value: unknown,
  options: { completed?: boolean; skipped?: boolean } = {},
): JobProgressStatus {
  if (options.skipped) {
    return 'skipped'
  }

  if (options.completed) {
    return 'completed'
  }

  if (typeof value === 'string') {
    const key = value.trim().toLowerCase().replace(/\s+/g, '_')
    if (key in STATUS_NORMALISATION) {
      return STATUS_NORMALISATION[key as keyof typeof STATUS_NORMALISATION]
    }
  }

  return 'scheduled'
}

export function parseIsoDateTime(value: unknown): string | null {
  if (!value) return null

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed.length) return null
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return null
}

export function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

export function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item): item is string => item.length > 0)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed.length) return []
    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
    }
    return [trimmed]
  }

  return []
}

export async function updateJobProgressStatus(
  supabase: SupabaseClient,
  jobId: string | null | undefined,
  status: JobProgressStatus,
  extraUpdates: Record<string, unknown> = {},
) {
  const normalizedJobId = typeof jobId === 'string' ? jobId.trim() : ''
  if (!normalizedJobId) return

  const nowIso = new Date().toISOString()
  const updates: Record<string, unknown> = { status, ...extraUpdates }

  if (status === 'en_route') {
    updates.started_at = extraUpdates.started_at ?? nowIso
  }

  if (status === 'on_site') {
    updates.arrived_at = extraUpdates.arrived_at ?? nowIso
  }

  if (status === 'completed') {
    updates.completed_at = extraUpdates.completed_at ?? nowIso
  }

  try {
    const { error } = await supabase.from('jobs').update(updates).eq('id', normalizedJobId)
    if (error) {
      console.warn('Failed to update job status', { jobId: normalizedJobId, status, error })
    }
  } catch (err) {
    console.warn('Unexpected error updating job status', { jobId: normalizedJobId, status, error: err })
  }
}

export async function updateJobsProgressStatus(
  supabase: SupabaseClient,
  jobIds: Array<string | null | undefined>,
  status: JobProgressStatus,
  extraUpdates: Record<string, unknown> = {},
) {
  const uniqueIds = Array.from(
    new Set(
      jobIds
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value): value is string => value.length > 0),
    ),
  )

  if (!uniqueIds.length) return

  const nowIso = new Date().toISOString()
  const updates: Record<string, unknown> = { status, ...extraUpdates }

  if (status === 'en_route') {
    updates.started_at = extraUpdates.started_at ?? nowIso
  }

  if (status === 'on_site') {
    updates.arrived_at = extraUpdates.arrived_at ?? nowIso
  }

  if (status === 'completed') {
    updates.completed_at = extraUpdates.completed_at ?? nowIso
  }

  try {
    const { error } = await supabase.from('jobs').update(updates).in('id', uniqueIds)
    if (error) {
      console.warn('Failed to update multiple job statuses', { jobIds: uniqueIds, status, error })
    }
  } catch (err) {
    console.warn('Unexpected error updating multiple job statuses', { jobIds: uniqueIds, status, error: err })
  }
}
