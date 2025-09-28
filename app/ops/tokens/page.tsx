// app/ops/tokens/page.tsx
import BackButton from '@/components/UI/BackButton'
import { supabaseServer } from '@/lib/supabaseServer'

type ClientListRow = {
  id: string
  client_name: string | null
  company: string | null
}

const deriveAccountId = (row: ClientListRow): string =>
  row.client_name?.trim() || row.company?.trim() || row.id

const deriveAccountName = (row: ClientListRow): string =>
  row.company?.trim() || row.client_name?.trim() || 'Client Account'

export default async function TokensPage() {
  const sb = supabaseServer()

  const { data: clientRows, error: clientError } = await sb
    .from('client_list')
    .select('id, client_name, company')

  if (clientError) {
    return (
      <div className="container">
        <BackButton />
        <h2>Error loading client accounts</h2>
        <p className="text-red-500">{clientError.message}</p>
      </div>
    )
  }

  const accountsMap = new Map<
    string,
    {
      id: string
      name: string
      propertyCount: number
    }
  >()

  ;((clientRows ?? []) as ClientListRow[]).forEach((row) => {
    const accountId = deriveAccountId(row)
    const accountName = deriveAccountName(row)
    const existing = accountsMap.get(accountId)
    if (existing) {
      existing.propertyCount += 1
    } else {
      accountsMap.set(accountId, {
        id: accountId,
        name: accountName,
        propertyCount: 1,
      })
    }
  })

  const accounts = Array.from(accountsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  )

  return (
    <div className="container">
      <BackButton />
      <h2 className="text-xl font-semibold mb-4">Client Portal Links</h2>

      <p className="mb-4 text-sm text-gray-600">
        Client portal links are generated from existing client records. Share a
        link below to grant access to the related properties. New link
        generation will be re-enabled once backend support is available.
      </p>

      <h3 className="font-medium mb-2">Available links</h3>
      {accounts.length === 0 ? (
        <p className="text-sm text-gray-600">No client records found.</p>
      ) : (
        <ul className="list-disc list-inside space-y-1">
          {accounts.map((account) => {
            const href = `/c/${encodeURIComponent(account.id)}`
            return (
              <li key={account.id}>
                <a target="_blank" href={href} rel="noreferrer">
                  {account.name} — {href}
                </a>
                <span className="ml-2 text-xs text-gray-500">
                  ({account.propertyCount} properties)
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
