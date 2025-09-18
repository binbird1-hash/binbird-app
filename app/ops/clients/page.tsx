'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ClientsPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('client_list_view').select('*')
      setRows(data || [])
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
              <td className="p-2 border">{r.bins_this_week}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
