// app/ops/clients/page.tsx
import BackButton from '@/components/UI/BackButton'
import { supabaseServer } from '@/lib/supabaseServer'

type ClientListRow = {
  id: string
  client_name: string | null
  company: string | null
  address: string | null
  red_freq: string | null
  red_flip: string | null
  yellow_freq: string | null
  yellow_flip: string | null
  green_freq: string | null
  green_flip: string | null
}

type TableRow = {
  id: string
  name: string
  address: string
  binsThisWeek: string
}

const describeBinFrequency = (
  color: string,
  frequency: string | null,
  flip: string | null,
): string | null => {
  if (!frequency) return null
  const base = `${color} (${frequency.toLowerCase()})`
  if (frequency === 'Fortnightly' && flip === 'Yes') {
    return `${base}, alternate weeks`
  }
  return base
}

const deriveBinsThisWeek = (row: ClientListRow): string => {
  const bins = [
    describeBinFrequency('Red', row.red_freq, row.red_flip),
    describeBinFrequency('Yellow', row.yellow_freq, row.yellow_flip),
    describeBinFrequency('Green', row.green_freq, row.green_flip),
  ].filter(Boolean) as string[]

  if (!bins.length) {
    return '—'
  }

  return bins.join(', ')
}

const deriveName = (row: ClientListRow): string =>
  row.client_name?.trim() || row.company?.trim() || 'Unnamed client'

const deriveAddress = (row: ClientListRow): string => row.address?.trim() || '—'

async function fetchClientRows(): Promise<TableRow[]> {
  const sb = supabaseServer()
  const { data, error } = await sb
    .from('client_list')
    .select(
      'id, client_name, company, address, red_freq, red_flip, yellow_freq, yellow_flip, green_freq, green_flip',
    )

  if (error) {
    console.warn('Failed to load client list', error)
    return []
  }

  return ((data ?? []) as ClientListRow[]).map((row) => ({
    id: row.id,
    name: deriveName(row),
    address: deriveAddress(row),
    binsThisWeek: deriveBinsThisWeek(row),
  }))
}

export default async function ClientsPage() {
  const rows = await fetchClientRows()

  return (
    <div className="container">
      <BackButton />
      <h2 className="text-xl font-bold mb-4">Client List</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">No client records found.</p>
      ) : (
        <table className="table-auto w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border text-left">Client</th>
              <th className="p-2 border text-left">Address</th>
              <th className="p-2 border text-left">Bins</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="p-2 border align-top">{row.name}</td>
                <td className="p-2 border align-top">{row.address}</td>
                <td className="p-2 border align-top">{row.binsThisWeek}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
