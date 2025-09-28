import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { parseLatLng } from '@/lib/utils'
import { ClientPortal } from '@/components/client/client-portal'
import type { ClientJob, ClientLog, ClientProperty } from '@/components/client/types'

export default async function ClientPage() {
  const { supabase, profile, user } = await requireAuth('client')

  const email = profile.email ?? user.email
  if (!email) {
    redirect('/auth/sign-in')
  }

  const { data: propertyRowsRaw, error: propertyError } = await supabase
    .from('client_list')
    .select('*')
    .eq('email', email)

  if (propertyError) {
    throw propertyError
  }

  const propertyRows = propertyRowsRaw ?? []

  if (propertyRows.length === 0) {
    return <div className="text-white/80">No properties linked to this account yet.</div>
  }

  const assignedStaffIds = propertyRows
    .map((row) => row.assigned_to)
    .filter((id): id is string => !!id)

  const { data: staffRowsRaw, error: staffError } = assignedStaffIds.length
    ? await supabase.from('user_profile').select('user_id, full_name').in('user_id', assignedStaffIds)
    : { data: null, error: null }

  if (staffError) {
    throw staffError
  }

  const staffRows = staffRowsRaw ?? []

  const staffById = new Map(staffRows.map((staff) => [staff.user_id, staff]))

  const properties: ClientProperty[] = propertyRows.map((row) => ({
    ...row,
    assigned_staff: row.assigned_to ? staffById.get(row.assigned_to) ?? null : null,
    coordinates: parseLatLng(row.lat_lng),
  }))

  const clientNames = properties
    .map((property) => property.client_name)
    .filter((name): name is string => !!name)

  const { data: jobRowsRaw, error: jobError } = clientNames.length
    ? await supabase.from('jobs').select('*').in('client_name', clientNames)
    : { data: null, error: null }

  if (jobError) {
    throw jobError
  }

  const jobRows = jobRowsRaw ?? []

  const jobIds = jobRows.map((job) => job.id)

  const { data: logRowsRaw, error: logError } = jobIds.length
    ? await supabase.from('logs').select('*').in('job_id', jobIds)
    : { data: null, error: null }

  if (logError) {
    throw logError
  }

  const logRows = logRowsRaw ?? []

  const logsByJob = logRows.reduce<Record<string, ClientLog[]>>((acc, log) => {
    if (!log.job_id) return acc
    acc[log.job_id] = acc[log.job_id] ? [...acc[log.job_id], log] : [log]
    return acc
  }, {})

  const jobs: ClientJob[] = jobRows.map((job) => ({
    ...job,
    status: 'pending',
    logs: logsByJob[job.id] ?? [],
  }))

  return <ClientPortal data={{ profile, properties, jobs, logs: logRows }} />
}
