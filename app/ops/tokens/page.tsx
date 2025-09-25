// app/ops/tokens/page.tsx
import BackButton from '@/components/UI/BackButton'
import { supabaseServer } from '@/lib/supabaseServer'

export default async function TokensPage() {
  async function createToken(formData: FormData) {
    'use server'
    const sb = supabaseServer()
    const accountId = formData.get('accountId') as string
    const token = crypto.randomUUID().replace(/-/g, '')
    await sb
      .from('client_token')
      .insert({ account_id: accountId, token })
  }

  const sb = supabaseServer()

  // Fetch all client accounts
  const { data: accounts, error: accountErr } = await sb
    .from('client_accounts')
    .select('id, name')
    .order('name')

  if (accountErr) {
    return (
      <div className="container">
        <BackButton />
        <h2>Error loading accounts</h2>
        <p className="text-red-500">{accountErr.message}</p>
      </div>
    )
  }

  // Fetch all tokens
  const { data: tokens, error: tokenErr } = await sb
    .from('client_token')
    .select('token, account:account_id(name)')
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
          name="accountId"
          className="border p-2 rounded"
          required
        >
          {accounts?.map((c: any) => (
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
              {t.account?.name} — /c/{t.token}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
