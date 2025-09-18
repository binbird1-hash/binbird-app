// app/ops/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import BackButton from '@/components/UI/BackButton'

export default function OpsDashboard() {
  const [stats, setStats] = useState({ clients: 0, logs: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { count: clientCount } = await supabase
        .from('client_list')
        .select('*', { count: 'exact', head: true })
      const { count: logCount } = await supabase
        .from('logs')
        .select('*', { count: 'exact', head: true })

      setStats({ clients: clientCount || 0, logs: logCount || 0 })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="container">Loading…</div>

  return (
    <div className="container">
      <BackButton />
      <h2 className="text-xl font-bold mb-4">Ops Dashboard</h2>
      <p>Total Clients: {stats.clients}</p>
      <p>Total Logs: {stats.logs}</p>
    </div>
  )
}
