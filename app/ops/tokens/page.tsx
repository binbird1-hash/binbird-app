// app/ops/tokens/page.tsx
import BackButton from '@/components/UI/BackButton'
import {
  deriveAccountId,
  deriveAccountName,
  type PortalClientRow,
} from '@/lib/clientPortalAccess'
import { supabaseServer } from '@/lib/supabaseServer'

export default async function TokensPage() {
  const sb = supabaseServer()

  const { data: tokenRows, error: tokenError } = await sb
    .from('client_portal_tokens')
    .select('token, account_id, property_id, created_at, expires_at')

  if (tokenError) {
    return (
      <div className="container">
        <BackButton />
        <h2>Error loading client accounts</h2>
        <p className="text-red-500">{tokenError.message}</p>
      </div>
    )
  }

  const tokens = tokenRows ?? []

  const accountIds = new Set<string>()
  const propertyIds = new Set<string>()

  tokens.forEach((row) => {
    const accountId = row.account_id?.trim()
    if (accountId) {
      accountIds.add(accountId)
    }
    const propertyId = row.property_id?.trim()
    if (propertyId) {
      propertyIds.add(propertyId)
    }
  })

  let clientRows: PortalClientRow[] = []

  if (accountIds.size || propertyIds.size) {
    const filters: string[] = []
    const escape = (value: string) => value.replace(/,/g, '\\,').replace(/'/g, "''")

    accountIds.forEach((accountId) => {
      filters.push(`account_id.eq.${escape(accountId)}`)
    })

    propertyIds.forEach((propertyId) => {
      filters.push(`id.eq.${escape(propertyId)}`)
    })

    const { data, error } = await sb
      .from('client_list')
      .select('id, account_id, client_name, company, address, notes')
      .or(filters.join(','))

    if (error) {
      return (
        <div className="container">
          <BackButton />
          <h2>Error loading client accounts</h2>
          <p className="text-red-500">{error.message}</p>
        </div>
      )
    }

    clientRows = (data ?? []).map((row) => ({
      id: row.id,
      account_id: row.account_id,
      client_name: row.client_name,
      company: row.company,
      address: row.address,
      notes: row.notes,
    }))
  }

  const clientsById = new Map<string, PortalClientRow>()
  clientRows.forEach((row) => {
    clientsById.set(row.id, row)
  })

  const accountsById = new Map<
    string,
    {
      id: string
      name: string
      properties: PortalClientRow[]
    }
  >()

  clientRows.forEach((row) => {
    const accountId = deriveAccountId(row)
    const existing = accountsById.get(accountId)
    if (existing) {
      existing.properties.push(row)
    } else {
      accountsById.set(accountId, {
        id: accountId,
        name: deriveAccountName(row),
        properties: [row],
      })
    }
  })

  const decoratedTokens = tokens.map((row) => {
    const property = row.property_id ? clientsById.get(row.property_id) ?? null : null
    const explicitAccountId = row.account_id?.trim() ?? null
    const resolvedAccountId = explicitAccountId ?? (property ? deriveAccountId(property) : null)
    const account = resolvedAccountId ? accountsById.get(resolvedAccountId) : null

    return {
      token: row.token,
      href: `/c/${encodeURIComponent(row.token)}`,
      accountName: property ? deriveAccountName(property) : account?.name ?? resolvedAccountId ?? 'Client Account',
      scopeDescription: property
        ? property.address ?? property.client_name ?? 'Property'
        : `${account?.properties.length ?? 0} properties`,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }
  })

  decoratedTokens.sort((a, b) => a.accountName.localeCompare(b.accountName))

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
      {decoratedTokens.length === 0 ? (
        <p className="text-sm text-gray-600">No client records found.</p>
      ) : (
        <ul className="list-disc list-inside space-y-1">
          {decoratedTokens.map((entry) => (
            <li key={entry.token}>
              <a target="_blank" href={entry.href} rel="noreferrer">
                {entry.accountName} — {entry.href}
              </a>
              <span className="ml-2 text-xs text-gray-500">
                ({entry.scopeDescription})
              </span>
              {entry.expiresAt && (
                <span className="ml-2 text-xs text-gray-400">
                  Expires {new Date(entry.expiresAt).toLocaleDateString()}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
