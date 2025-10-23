'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/components/providers/SupabaseProvider'
import { normalizePortalRole } from '@/lib/portalRoles'
import GuestDashboard from './GuestDashboard'
import StaffDashboard from './StaffDashboard'
import AdminDashboard from './AdminDashboard'

export default function Dashboard() {
  const supabase = useSupabase()
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setRole('guest')
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('user_profile')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()

      const normalizedRole = normalizePortalRole(profile?.role)
      setRole(normalizedRole ?? 'staff')
      setLoading(false)
    }
    load()
  }, [supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="animate-pulse text-base text-gray-400">Loading…</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-black border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#ff5757]">BinBird</h1>

        {/* Show sign out only if logged in */}
        {(role === 'staff' || role === 'admin') && (
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.reload()
            }}
            className="px-3 py-1.5 rounded-lg bg-[#ff5757] text-black text-sm font-semibold hover:opacity-90 active:scale-95 transition"
          >
            Sign Out
          </button>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-6 py-8">
        {role === 'guest' && <GuestDashboard />}
        {role === 'admin' && <AdminDashboard />}
        {role === 'staff' && <StaffDashboard />}
      </main>

      {/* Footer */}
      <footer className="px-4 py-2 text-center text-xs text-white/40 bg-black">
        © {new Date().getFullYear()} BinBird
      </footer>
    </div>
  )
}
