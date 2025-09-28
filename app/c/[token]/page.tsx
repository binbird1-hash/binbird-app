// app/c/[token]/page.tsx
import BackButton from '@/components/UI/BackButton'
import { supabaseServer } from '@/lib/supabaseServer'

export default async function ClientPortal({
  params: { token },
}: {
  params: { token: string }
}) {
  const sb = supabaseServer()

  const { data, error } = await sb
    .from('client_token')
    .select('token, client:client_id(id, name, properties(id, address, notes))')
    .eq('token', token)
    .maybeSingle<{
      token: string
      client: {
        id: string
        name: string | null
        properties: { id: string; address: string | null; notes: string | null }[]
      }[]
    }>()

  if (error) {
    return (
      <div className="container">
        <BackButton />
        <h2>Error loading client portal</h2>
        <p className="text-red-500">{error.message}</p>
      </div>
    )
  }

  const client = data?.client?.[0] // still array, take first

  return (
    <div className="container">
      <BackButton />
      <h2 className="text-xl font-semibold mb-4">
        Client Portal — {client?.name}
      </h2>

      {client?.properties?.length ? (
        <ul className="space-y-2">
          {client.properties.map((p) => (
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
