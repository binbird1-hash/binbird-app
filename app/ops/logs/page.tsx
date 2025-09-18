'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('logs')
        .select('*')
        .order('done_on', { ascending: false })
      setLogs(data || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="container">Loading…</div>

  return (
    <div className="container">
      <h2 className="text-xl font-bold mb-4">Logs & Proofs</h2>
      {logs.length === 0 && <p>No logs yet.</p>}
      <ul className="space-y-2">
        {logs.map(l => (
          <li key={l.id} className="p-3 border rounded">
            <div><b>{l.task_type}</b> — {l.address}</div>
            <div>{l.done_on}</div>
            {l.photo_path && (
              <a
                href={supabase.storage.from('proofs').getPublicUrl(l.photo_path).data.publicUrl}
                target="_blank"
                className="text-blue-500 underline"
              >
                View Proof
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
