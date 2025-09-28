// app/c/[token]/page.tsx
import BackButton from '@/components/UI/BackButton'
import { supabaseServer } from '@/lib/supabaseServer'
import type { JobRecord, Property } from '@/lib/database.types'

type ClientListRow = {
  id: string
  client_name: string | null
  company: string | null
  address: string | null
  notes: string | null
}

const deriveAccountId = (row: ClientListRow): string =>
  row.client_name?.trim() || row.company?.trim() || row.id

const deriveAccountName = (row: ClientListRow): string =>
  row.company?.trim() || row.client_name?.trim() || 'Client Account'

const toProperty = (row: ClientListRow): Property => ({
  id: row.id,
  address: row.address,
  notes: row.notes,
})

const fetchClientRowsForToken = async (
  accountId: string,
  sb: ReturnType<typeof supabaseServer>,
) => {
  const selectColumns = 'id, client_name, company, address, notes'
  const deduped = new Map<string, ClientListRow>()
  const queryColumns: Array<keyof ClientListRow> = ['id', 'client_name', 'company']

  for (const column of queryColumns) {
    const { data, error } = await sb
      .from('client_list')
      .select(selectColumns)
      .eq(column as string, accountId)

    if (error) {
      console.warn(`Failed to query client_list by ${column}`, error)
      continue
    }

    if (data?.length) {
      data.forEach((row) => deduped.set(row.id, row as ClientListRow))
      break
    }
  }

  if (!deduped.size) {
    const { data, error } = await sb
      .from('client_list')
      .select(selectColumns)

    if (error) {
      console.warn('Failed to fetch client_list for portal fallback', error)
      return [] as ClientListRow[]
    }

    data?.forEach((row) => {
      const typed = row as ClientListRow
      if (deriveAccountId(typed) === accountId) {
        deduped.set(typed.id, typed)
      }
    })
  }

  return Array.from(deduped.values()) as ClientListRow[]
}

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

  const clientRows = await fetchClientRowsForToken(accountToken, sb)
  const matchingRows = clientRows.filter(
    (row) => deriveAccountId(row) === accountToken,
  )

  if (!matchingRows.length) {
    return (
      <div className="container">
        <BackButton />
        <h2>Error loading client portal</h2>
        <p className="text-red-500">No client data found for this link.</p>
      </div>
    )
  }

  const accountName = deriveAccountName(matchingRows[0])

  const [jobsResult, logsResult] = await Promise.all([
    sb
      .from('jobs')
      .select(
        'id, account_id, property_id, address, lat, lng, job_type, bins, notes, client_name, photo_path, last_completed_on, assigned_to, day_of_week',
      )
      .eq('client_name', accountToken),
    sb
      .from('logs')
      .select(
        'id, job_id, client_name, address, task_type, bins, notes, photo_path, done_on, gps_lat, gps_lng, created_at',
      )
      .eq('client_name', accountToken)
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

  const properties = matchingRows.map(toProperty)
  const jobs = (jobsResult.data ?? []) as JobRecord[]
  const logs = logsResult.data ?? []

  return (
    <div className="container">
      <BackButton />
      <h2 className="text-xl font-semibold mb-4">
        Client Portal — {accountName}
      </h2>

      {properties.length ? (
        <ul className="space-y-2">
          {properties.map((p) => (
            <li key={p.id} className="p-3 border rounded">
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
