'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

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

  useEffect(() => {
    if (logs.length === 0) return

    const photoPaths = logs
      .map(log => log.photo_path as string | null)
      .filter((path): path is string => Boolean(path))

    const missingPaths = photoPaths.filter(path => !signedUrls[path])
    if (missingPaths.length === 0) return

    const uniqueMissingPaths = Array.from(new Set(missingPaths))

    let cancelled = false

    const loadSignedUrls = async () => {
      const { data, error } = await supabase.storage
        .from('proofs')
        .createSignedUrls(uniqueMissingPaths, 60 * 60)

      if (error) {
        console.warn('Failed to create signed proof URLs', error)
        return
      }

      if (cancelled || !data) return

      setSignedUrls(prev => {
        const updated = { ...prev }
        for (const entry of data) {
          if (entry.path && entry.signedUrl) {
            updated[entry.path] = entry.signedUrl
          }
        }
        return updated
      })
    }

    loadSignedUrls()

    return () => {
      cancelled = true
    }
  }, [logs, signedUrls])

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
            {l.photo_path && signedUrls[l.photo_path] && (
              <a
                href={signedUrls[l.photo_path]}
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
