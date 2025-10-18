// app/c/[token]/page.tsx
import BackButton from '@/components/UI/BackButton'
import { buildOrFilters, resolvePortalScope, type PortalClientRow } from '@/lib/clientPortalAccess'
import { coerceJobStatus, getJobSelectFields, isStatusColumnMissing, type RawJobRow } from '@/lib/jobs'
import { supabaseServer } from '@/lib/supabaseServer'
import type { JobRecord, Property } from '@/lib/database.types'

const toProperty = (row: PortalClientRow): Property => ({
  property_id: row.property_id,
  address: row.address,
  notes: row.notes,
})

export default async function ClientPortal({
  params: { token },
}: {
  params: { token: string }
}) {
  const sb = supabaseServer()

  let accountToken = token
  try {
    accountToken = decodeURIComponent(token).trim()
  } catch (error) {
    console.warn('Failed to decode client portal token', error)
    accountToken = ''
  }

  if (!accountToken) {
    return (
      <div className="container">
        <BackButton />
        <h2>Error loading client portal</h2>
        <p className="text-red-500">Invalid token.</p>
      </div>
    )
  }

  const scope = await resolvePortalScope(sb, accountToken)

  if (!scope) {
    return (
      <div className="container">
        <BackButton />
        <h2>Error loading client portal</h2>
        <p className="text-red-500">No client data found for this link.</p>
      </div>
    )
  }

  const accountFilters = buildOrFilters('account_id', [scope.accountId])
  const propertyFilters = buildOrFilters('property_id', scope.propertyIds)
  const jobsFilters = [...accountFilters, ...propertyFilters]

  const jobSelectWithStatus = getJobSelectFields(true)
  const jobSelectWithoutStatus = getJobSelectFields(false)

  const buildJobQuery = (columns: string) =>
    sb
      .from('jobs')
      .select(columns)
      .or(jobsFilters.join(','))

  const jobsPromise = jobsFilters.length
    ? (async () => {
        const { data, error } = await buildJobQuery(jobSelectWithStatus)
        if (!error && data) {
          return { data: coerceJobStatus(data as RawJobRow[]), error: null }
        }

        if (error && isStatusColumnMissing(error)) {
          const { data: fallbackData, error: fallbackError } = await buildJobQuery(jobSelectWithoutStatus)
          if (!fallbackError && fallbackData) {
            return { data: coerceJobStatus(fallbackData as RawJobRow[]), error: null }
          }
          return { data: [] as JobRecord[], error: fallbackError }
        }

        return { data: [] as JobRecord[], error }
      })()
    : Promise.resolve({ data: [] as JobRecord[], error: null })

  const [jobsResult, logsResult] = await Promise.all([
    jobsPromise,
    sb
      .from('logs')
      .select(
        'id, job_id, account_id, client_name, address, task_type, bins, notes, photo_path, done_on, gps_lat, gps_lng, created_at',
      )
      .eq('account_id', scope.accountId)
      .order('done_on', { ascending: false }),
  ])

  if (jobsResult.error || logsResult.error) {
    const message = jobsResult.error?.message ?? logsResult.error?.message ?? 'Unknown error'
    return (
      <div className="container">
        <BackButton />
        <h2>Error loading client portal</h2>
        <p className="text-red-500">{message}</p>
      </div>
    )
  }

  const properties = scope.rows.map(toProperty)
  const jobs = (jobsResult.data ?? []) as JobRecord[]
  const logs = logsResult.data ?? []

  return (
    <div className="container">
      <BackButton />
      <h2 className="text-xl font-semibold mb-4">
        Client Portal — {scope.accountName}
      </h2>

      {properties.length ? (
        <ul className="space-y-2">
          {properties.map((p) => (
            <li key={p.property_id} className="p-3 border rounded">
              <p className="font-medium">{p.address}</p>
              <p className="text-sm opacity-70">{p.notes || 'No notes'}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>No properties linked to this client.</p>
      )}

      <section className="mt-6">
        <h3 className="font-medium mb-2">Recent Jobs</h3>
        {jobs.length ? (
          <ul className="space-y-2 text-sm">
            {jobs.map((job) => (
              <li key={job.id} className="p-3 border rounded">
                <p className="font-medium">{job.address ?? 'Job'}</p>
                <p className="text-xs text-gray-600">
                  {job.job_type ?? 'Service'} — Last completed:{' '}
                  {job.last_completed_on ?? 'Not recorded'}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-600">No jobs recorded for this client.</p>
        )}
      </section>

      <section className="mt-6">
        <h3 className="font-medium mb-2">Recent Logs</h3>
        {logs.length ? (
          <ul className="space-y-2 text-sm">
            {logs.map((log: any) => (
              <li key={log.id} className="p-3 border rounded">
                <p className="font-medium">{log.address ?? 'Log entry'}</p>
                <p className="text-xs text-gray-600">
                  {log.task_type ?? 'Visit'} — {log.done_on ?? 'Not recorded'}
                </p>
                {log.notes ? (
                  <p className="text-xs text-gray-700 mt-1">{log.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-600">No logs recorded for this client.</p>
        )}
      </section>
    </div>
  )
}
