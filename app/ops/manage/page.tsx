import BackButton from '@/components/UI/BackButton'
import Card from '@/components/UI/Card'
import AdminManagementTable, {
  type AdminAccountGroup,
  type AdminManagedProperty,
  type AdminStaffMember,
} from '@/components/ops/AdminManagementTable'
import { supabaseServer } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import { Building2, ClipboardList, Users } from 'lucide-react'

type ClientListRow = {
  id: string
  account_id: string | null
  client_name: string | null
  company: string | null
  address: string | null
  collection_day: string | null
  put_bins_out: string | null
  notes: string | null
  assigned_to: string | null
  red_freq: string | null
  red_flip: string | null
  yellow_freq: string | null
  yellow_flip: string | null
  green_freq: string | null
  green_flip: string | null
}

type StaffRow = {
  user_id: string
  full_name: string | null
  role: string | null
}

const describeBinFrequency = (color: string, frequency: string | null, flip: string | null): string | null => {
  if (!frequency) return null
  const base = `${color} (${frequency.toLowerCase()})`
  if (frequency === 'Fortnightly' && flip === 'Yes') {
    return `${base}, alternate weeks`
  }
  return base
}

const buildBinSummary = (row: ClientListRow): string | null => {
  const entries = [
    describeBinFrequency('Red', row.red_freq, row.red_flip),
    describeBinFrequency('Yellow', row.yellow_freq, row.yellow_flip),
    describeBinFrequency('Green', row.green_freq, row.green_flip),
  ].filter(Boolean) as string[]

  if (!entries.length) return null
  return entries.join(', ')
}

const toNullable = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const deriveAccountId = (row: ClientListRow): string => toNullable(row.account_id) ?? row.id

const deriveAccountName = (row: ClientListRow): string =>
  toNullable(row.company) ?? toNullable(row.client_name) ?? 'Client account'

const derivePropertyLabel = (row: ClientListRow): string => {
  const clientName = toNullable(row.client_name)
  if (clientName) return clientName

  const address = toNullable(row.address)
  if (address) {
    const [firstLine] = address.split(',')
    if (firstLine && firstLine.trim().length) {
      return firstLine.trim()
    }
  }

  return 'Property'
}

const mapClientRowsToAccounts = (rows: ClientListRow[]): AdminAccountGroup[] => {
  const groups = new Map<string, AdminAccountGroup>()

  rows.forEach((row) => {
    const accountId = deriveAccountId(row)
    const accountName = deriveAccountName(row)
    const property: AdminManagedProperty = {
      id: row.id,
      accountId,
      accountName,
      propertyLabel: derivePropertyLabel(row),
      clientName: toNullable(row.client_name),
      companyName: toNullable(row.company),
      address: toNullable(row.address) ?? '',
      collectionDay: toNullable(row.collection_day),
      putBinsOut: toNullable(row.put_bins_out),
      notes: toNullable(row.notes),
      assignedTo: toNullable(row.assigned_to),
      binSummary: buildBinSummary(row),
    }

    const existing = groups.get(accountId)
    if (existing) {
      existing.properties.push(property)
    } else {
      groups.set(accountId, {
        id: accountId,
        name: accountName,
        properties: [property],
      })
    }
  })

  const list = Array.from(groups.values())
  list.forEach((group) => {
    group.properties.sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel))
  })

  return list.sort((a, b) => a.name.localeCompare(b.name))
}

const mapStaffRows = (rows: StaffRow[]): AdminStaffMember[] =>
  rows
    .filter((row): row is StaffRow & { user_id: string } => typeof row.user_id === 'string' && row.user_id.length > 0)
    .map((row) => ({
      id: row.user_id,
      name: toNullable(row.full_name) ?? 'Unnamed staff member',
      role: row.role ?? 'staff',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

export default async function ManagePage() {
  const sb = supabaseServer()
  const {
    data: { user },
    error: userError,
  } = await sb.auth.getUser()

  if (userError) {
    console.error('Failed to resolve user session for /ops/manage', userError)
  }

  if (!user) {
    redirect('/auth')
  }

  const { data: profile, error: profileError } = await sb
    .from('user_profile')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Failed to load profile for manage screen', profileError)
  }

  if (profile?.role !== 'admin') {
    redirect('/ops')
  }

  const [clientsResponse, staffResponse] = await Promise.all([
    sb
      .from('client_list')
      .select(
        `id, account_id, client_name, company, address, collection_day, put_bins_out, notes, assigned_to, red_freq, red_flip, yellow_freq, yellow_flip, green_freq, green_flip`,
      ),
    sb
      .from('user_profile')
      .select('user_id, full_name, role')
      .in('role', ['staff', 'admin']),
  ])

  const clientError = clientsResponse.error
  if (clientError) {
    console.error('Failed to load client list for manage screen', clientError)
  }

  const staffError = staffResponse.error
  if (staffError) {
    console.error('Failed to load staff directory for manage screen', staffError)
  }

  const clientRows = (clientsResponse.data ?? []) as ClientListRow[]
  const staffRows = (staffResponse.data ?? []) as StaffRow[]

  const accounts = clientError ? [] : mapClientRowsToAccounts(clientRows)
  const staff = mapStaffRows(staffRows)

  const totalProperties = accounts.reduce((acc, group) => acc + group.properties.length, 0)

  return (
    <div className="container space-y-6 py-6">
      <BackButton />
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Client &amp; Staff Management</h1>
        <p className="mt-1 text-sm text-gray-600">
          Review client properties, adjust service details, and assign staff members to each property.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card title={`Accounts: ${accounts.length}`} icon={Building2} />
        <Card title={`Properties: ${totalProperties}`} icon={ClipboardList} />
        <Card title={`Active staff: ${staff.length}`} icon={Users} />
      </div>

      {clientError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          We could not load the client list. Please try again shortly.
        </div>
      ) : (
        <AdminManagementTable accounts={accounts} staff={staff} />
      )}

      {staffError && !clientError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Staff profiles could not be loaded. Existing assignments are shown, but new assignments may be limited to known users.
        </div>
      )}
    </div>
  )
}
