'use client'
import { useEffect, useMemo, useState } from 'react'
import { useSupabase } from '@/components/providers/SupabaseProvider'
import { deriveProofPathFromLog } from '@/lib/proof-paths'

export default function LogsPage() {
  const supabase = useSupabase()
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
  }, [supabase])

  const resolvedPhotoPaths = useMemo(() => {
    const map: Record<string, string> = {}
    logs.forEach(log => {
      const rawId = log?.id
      if (rawId === null || rawId === undefined) return
      const key = typeof rawId === 'string' ? rawId : String(rawId)
      const path = deriveProofPathFromLog(log)
      if (path) {
        map[key] = path
      }
    })
    return map
  }, [logs])

  useEffect(() => {
    const photoPaths = Object.values(resolvedPhotoPaths)
    if (photoPaths.length === 0) return

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
  }, [resolvedPhotoPaths, signedUrls, supabase])

  if (loading) return <div className="container">Loading…</div>

  return (
    <div className="container">
      <h2 className="text-xl font-bold mb-4">Logs & Proofs</h2>
      {logs.length === 0 && <p>No logs yet.</p>}
      <ul className="space-y-2">
        {logs.map(l => {
          const rawId = l?.id
          const key = rawId === null || rawId === undefined ? undefined : typeof rawId === 'string' ? rawId : String(rawId)
          const resolvedPath = key ? resolvedPhotoPaths[key] : undefined
          const signedUrl = resolvedPath ? signedUrls[resolvedPath] : undefined
          return (
          <li key={l.id} className="p-3 border rounded">
            <div><b>{l.task_type}</b> — {l.address}</div>
            <div>{l.done_on}</div>
            {resolvedPath ? (
              signedUrl ? (
                <a
                  href={signedUrl}
                  target="_blank"
                  className="text-blue-500 underline"
                >
                  View Proof
                </a>
              ) : (
                <span className="text-gray-500">Proof unavailable</span>
              )
            ) : null}
          </li>
        )})}
      </ul>
    </div>
  )
}
