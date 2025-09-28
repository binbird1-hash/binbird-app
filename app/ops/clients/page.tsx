'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type ClientListRow = {
  id: string
  client_name: string | null
  address: string | null
  red_freq: string | null
  red_flip: string | null
  yellow_freq: string | null
  yellow_flip: string | null
  green_freq: string | null
  green_flip: string | null
}

type TableRow = ClientListRow & { bins_this_week: string | null }

const describeBinFrequency = (color: string, frequency: string | null, flip: string | null) => {
  if (!frequency) return null
  const base = `${color} (${frequency.toLowerCase()})`
  if (frequency === 'Fortnightly' && flip === 'Yes') {
    return `${base}, alternate weeks`
  }
  return base
}

const deriveBinsSummary = (row: ClientListRow): string | null => {
  const entries = [
    describeBinFrequency('Red', row.red_freq, row.red_flip),
    describeBinFrequency('Yellow', row.yellow_freq, row.yellow_flip),
    describeBinFrequency('Green', row.green_freq, row.green_flip),
  ].filter(Boolean) as string[]

  if (!entries.length) return null
  return entries.join(', ')
}

export default function ClientsPage() {
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('client_list')
        .select(
          `id, client_name, address, red_freq, red_flip, yellow_freq, yellow_flip, green_freq, green_flip`,
        )

      if (error) {
        console.warn('Failed to load clients', error)
        setRows([])
      } else {
        const derived = (data ?? []).map((row) => ({
          ...row,
          bins_this_week: deriveBinsSummary(row),
        }))
        setRows(derived)
      }
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
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="p-2 border">{r.client_name}</td>
              <td className="p-2 border">{r.address}</td>
              <td className="p-2 border">{r.bins_this_week ?? '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
