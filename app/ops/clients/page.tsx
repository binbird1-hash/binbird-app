'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

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

export default function ClientsPage() {
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('client_list')
        .select(
          'id, client_name, company, address, red_freq, red_flip, yellow_freq, yellow_flip, green_freq, green_flip',
        )

      const formatted = (data ?? []).map((row) => {
        const typed = row as ClientListRow
        return {
          id: typed.id,
          name: deriveName(typed),
          address: deriveAddress(typed),
          binsThisWeek: deriveBinsThisWeek(typed),
        }
      })

      setRows(formatted)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="container">Loading…</div>

  return (
    <div className="container">
      <h2 className="text-xl font-bold mb-4">Client List</h2>
      <table className="table-auto w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Client</th>
            <th className="p-2 border">Address</th>
            <th className="p-2 border">Bins</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="p-2 border">{row.name}</td>
              <td className="p-2 border">{row.address}</td>
              <td className="p-2 border">{row.binsThisWeek}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
