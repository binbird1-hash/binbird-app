// app/c/[token]/page.tsx
import BackButton from '@/components/UI/BackButton'
import { supabaseServer } from '@/lib/supabaseServer'
import type { ClientTokenRow, JobRecord, Property } from '@/lib/database.types'

export default async function ClientPortal({
  params: { token },
}: {
  params: { token: string }
}) {
  const sb = supabaseServer()

  const { data, error } = await sb
    .from('client_token')
    .select('token, account:account_id(id, name)')
    .eq('token', token)
    .maybeSingle<ClientTokenRow>()

  if (error) {
    return (
      <div className="container">
        <BackButton />
        <h2>Error loading client portal</h2>
        <p className="text-red-500">{error.message}</p>
      </div>
    )
  }

  const [propertiesResult, jobsResult, logsResult] = await Promise.all([
    sb.rpc('properties_for_token', { p_token: token }),
    sb.rpc('jobs_for_token', { p_token: token }),
    sb.rpc('logs_for_token', { p_token: token }),
  ])

  const rpcError = propertiesResult.error ?? jobsResult.error ?? logsResult.error

  if (rpcError) {
    return (
      <div className="container">
        <BackButton />
        <h2>Error loading client portal</h2>
        <p className="text-red-500">{rpcError.message}</p>
      </div>
    )
  }

  const portalData = {
    properties: (propertiesResult.data ?? []) as Property[],
    jobs: (jobsResult.data ?? []) as JobRecord[],
    logs: logsResult.data ?? [],
  }

  const account = data?.account
  const properties = portalData.properties

  return (
    <div className="container">
      <BackButton />
      <h2 className="text-xl font-semibold mb-4">
        Client Portal — {account?.name}
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
        <p>No properties linked to this token.</p>
      )}
    </div>
  )
}
