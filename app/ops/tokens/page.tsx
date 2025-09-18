// app/ops/tokens/page.tsx
import BackButton from '@/components/UI/BackButton'
import { supabaseServer } from '@/lib/supabaseServer'

export default async function TokensPage() {
  async function createToken(formData: FormData) {
    'use server'
    const sb = supabaseServer()
    const clientId = formData.get('clientId') as string
    const token = crypto.randomUUID().replace(/-/g, '')
    await sb.from('client_token').insert({ client_id: clientId, token })
  }

  const sb = supabaseServer()

  // Fetch all clients
  const { data: clients, error: clientErr } = await sb
    .from('client')
    .select('id, name')
    .order('name')

  if (clientErr) {
    return (
      <div className="container">
        <BackButton />
        <h2>Error loading clients</h2>
        <p className="text-red-500">{clientErr.message}</p>
      </div>
    )
  }

  // Fetch all tokens
  const { data: tokens, error: tokenErr } = await sb
    .from('client_token')
    .select('token, client:client_id(name)')
    .order('created_at', { ascending: false })

  if (tokenErr) {
    return (
      <div className="container">
        <BackButton />
        <h2>Error loading tokens</h2>
        <p className="text-red-500">{tokenErr.message}</p>
      </div>
    )
  }

  return (
    <div className="container">
      <BackButton />
      <h2 className="text-xl font-semibold mb-4">Client Tokens</h2>

      {/* Token generator */}
      <form action={createToken} className="mb-6 space-x-2">
        <select
          name="clientId"
          className="border p-2 rounded"
          required
        >
          {clients?.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="btn" type="submit">
          Generate
        </button>
      </form>

      {/* Existing tokens */}
      <h3 className="font-medium mb-2">Existing</h3>
      <ul className="list-disc list-inside space-y-1">
        {tokens?.map((t: any) => (
          <li key={t.token}>
            <a target="_blank" href={`/c/${t.token}`}>
              {t.client?.name} — /c/{t.token}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
