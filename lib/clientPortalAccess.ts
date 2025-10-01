import type { SupabaseClient } from '@supabase/supabase-js'

export type PortalClientRow = {
  id: string
  account_id: string | null
  client_name: string | null
  company: string | null
  address: string | null
  notes: string | null
}

type PortalTokenRow = {
  account_id: string | null
  property_id: string | null
  expires_at: string | null
}

const escapeFilterValue = (value: string) => value.replace(/,/g, '\\,').replace(/'/g, "''")

export const deriveAccountId = (row: PortalClientRow): string => {
  const explicit = row.account_id?.trim()
  return explicit && explicit.length > 0 ? explicit : row.id
}

export const deriveAccountName = (row: PortalClientRow): string =>
  row.company?.trim() || row.client_name?.trim() || 'Client Account'

async function fetchPortalClientRows(
  supabase: SupabaseClient,
  accountIds: string[],
  propertyIds: string[],
): Promise<PortalClientRow[]> {
  const filters: string[] = []

  accountIds.forEach((accountId) => {
    const trimmed = accountId.trim()
    if (trimmed) {
      filters.push(`account_id.eq.${escapeFilterValue(trimmed)}`)
    }
  })

  propertyIds.forEach((propertyId) => {
    const trimmed = propertyId.trim()
    if (trimmed) {
      filters.push(`id.eq.${escapeFilterValue(trimmed)}`)
    }
  })

  if (!filters.length) {
    return []
  }

  const { data, error } = await supabase
    .from('client_list')
    .select('id, account_id, client_name, company, address, notes')
    .or(filters.join(','))

  if (error) {
    console.warn('Failed to load client portal rows', error)
    return []
  }

  const deduped = new Map<string, PortalClientRow>()

  ;(data ?? []).forEach((row) => {
    const id = typeof row.id === 'string' ? row.id.trim() : null
    if (!id) return

    deduped.set(id, {
      id,
      account_id: typeof row.account_id === 'string' ? row.account_id : null,
      client_name: typeof row.client_name === 'string' ? row.client_name : null,
      company: typeof row.company === 'string' ? row.company : null,
      address: typeof row.address === 'string' ? row.address : null,
      notes: typeof row.notes === 'string' ? row.notes : null,
    })
  })

  return Array.from(deduped.values())
}

const tokenExpired = (row: PortalTokenRow | null): boolean => {
  if (!row?.expires_at) return false
  const expiresAt = Date.parse(row.expires_at)
  if (Number.isNaN(expiresAt)) return false
  return expiresAt < Date.now()
}

export type PortalScope = {
  accountId: string
  accountName: string
  propertyIds: string[]
  rows: PortalClientRow[]
  expiresAt: string | null
}

export async function resolvePortalScope(
  supabase: SupabaseClient,
  token: string,
): Promise<PortalScope | null> {
  const trimmedToken = token.trim()
  if (!trimmedToken) {
    return null
  }

  const { data: tokenRow, error: tokenError } = await supabase
    .from('client_portal_tokens')
    .select('account_id, property_id, expires_at')
    .eq('token', trimmedToken)
    .maybeSingle()

  if (tokenError) {
    console.warn('Failed to validate client portal token', tokenError)
    return null
  }

  if (!tokenRow || tokenExpired(tokenRow)) {
    return null
  }

  const candidateAccountIds: string[] = []
  const candidatePropertyIds: string[] = []

  if (tokenRow.account_id && tokenRow.account_id.trim().length) {
    candidateAccountIds.push(tokenRow.account_id.trim())
  }

  if (tokenRow.property_id && tokenRow.property_id.trim().length) {
    candidatePropertyIds.push(tokenRow.property_id.trim())
  }

  const clientRows = await fetchPortalClientRows(
    supabase,
    candidateAccountIds,
    candidatePropertyIds,
  )

  if (!clientRows.length) {
    return null
  }

  const canonicalAccountId =
    candidateAccountIds.find((value) => value.trim().length) ??
    (() => {
      if (tokenRow.property_id) {
        const target = clientRows.find((row) => row.id === tokenRow.property_id)
        return target ? deriveAccountId(target) : null
      }
      return deriveAccountId(clientRows[0]!)
    })()

  if (!canonicalAccountId) {
    return null
  }

  const scopedRows = tokenRow.property_id
    ? clientRows.filter((row) => row.id === tokenRow.property_id)
    : clientRows.filter((row) => deriveAccountId(row) === canonicalAccountId)

  if (!scopedRows.length) {
    return null
  }

  return {
    accountId: canonicalAccountId,
    accountName: deriveAccountName(scopedRows[0]!),
    propertyIds: scopedRows.map((row) => row.id),
    rows: scopedRows,
    expiresAt: tokenRow.expires_at,
  }
}

export const buildOrFilters = (field: string, values: string[]): string[] => {
  const filters: string[] = []
  values.forEach((value) => {
    const trimmed = value.trim()
    if (trimmed.length) {
      filters.push(`${field}.eq.${escapeFilterValue(trimmed)}`)
    }
  })
  return filters
}
