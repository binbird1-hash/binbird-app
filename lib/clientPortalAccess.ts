import type { SupabaseClient } from '@supabase/supabase-js'

export type PortalClientRow = {
  property_id: string
  account_id: string | null
  client_name: string | null
  company: string | null
  address: string | null
  notes: string | null
}

const escapeFilterValue = (value: string) => value.replace(/,/g, '\\,').replace(/'/g, "''")

export const deriveAccountId = (row: PortalClientRow): string => {
  const explicit = row.account_id?.trim()
  return explicit && explicit.length > 0 ? explicit : row.property_id
}

export const deriveAccountName = (row: PortalClientRow): string =>
  row.company?.trim() || row.client_name?.trim() || 'Client Account'

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

  const selectColumns =
    'property_id, account_id, client_name, company, address, notes'

  const { data: propertyMatches, error: propertyError } = await supabase
    .from('client_list')
    .select(selectColumns)
    .eq('property_id', trimmedToken)

  if (propertyError) {
    console.warn('Failed to resolve client portal scope', propertyError)
    return null
  }

  const normaliseRow = (row: PortalClientRow): PortalClientRow => ({
    property_id: typeof row.property_id === 'string' ? row.property_id.trim() : '',
    account_id:
      typeof row.account_id === 'string' && row.account_id.trim().length
        ? row.account_id.trim()
        : null,
    client_name:
      typeof row.client_name === 'string' && row.client_name.trim().length
        ? row.client_name.trim()
        : null,
    company:
      typeof row.company === 'string' && row.company.trim().length
        ? row.company.trim()
        : null,
    address:
      typeof row.address === 'string' && row.address.trim().length
        ? row.address.trim()
        : null,
    notes:
      typeof row.notes === 'string' && row.notes.trim().length ? row.notes.trim() : null,
  })

  const normaliseRows = (rows: PortalClientRow[] | null | undefined) => {
    const deduped = new Map<string, PortalClientRow>()
    ;(rows ?? []).forEach((row) => {
      const normalised = normaliseRow(row)
      if (normalised.property_id) {
        deduped.set(normalised.property_id, normalised)
      }
    })
    return Array.from(deduped.values())
  }

  let scopedRows: PortalClientRow[] = normaliseRows(propertyMatches as PortalClientRow[])
  let canonicalAccountId: string | null = scopedRows.length
    ? deriveAccountId(scopedRows[0]!)
    : null

  if (!scopedRows.length) {
    const { data: accountMatches, error: accountError } = await supabase
      .from('client_list')
      .select(selectColumns)
      .eq('account_id', trimmedToken)

    if (accountError) {
      console.warn('Failed to resolve client portal account scope', accountError)
      return null
    }

    scopedRows = normaliseRows(accountMatches as PortalClientRow[])
    canonicalAccountId = scopedRows.length
      ? deriveAccountId(scopedRows[0]!)
      : trimmedToken
  } else if (canonicalAccountId && canonicalAccountId !== trimmedToken) {
    const { data: accountRows, error: accountError } = await supabase
      .from('client_list')
      .select(selectColumns)
      .eq('account_id', canonicalAccountId)

    if (accountError) {
      console.warn('Failed to load additional client rows', accountError)
    } else {
      const additionalRows = normaliseRows(accountRows as PortalClientRow[] | null | undefined)
      scopedRows = normaliseRows([...scopedRows, ...additionalRows])
    }
  }

  if (!scopedRows.length) {
    return null
  }

  const accountId = canonicalAccountId ?? deriveAccountId(scopedRows[0]!)
  if (!accountId) {
    return null
  }

  return {
    accountId,
    accountName: deriveAccountName(scopedRows[0]!),
    propertyIds: scopedRows.map((row) => row.property_id),
    rows: scopedRows,
    expiresAt: null,
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
