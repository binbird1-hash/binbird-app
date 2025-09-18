'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import GuestDashboard from './GuestDashboard'
import StaffDashboard from './StaffDashboard'
import AdminDashboard from './AdminDashboard'

export default function Dashboard() {
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
        .eq('id', user.id)
        .maybeSingle()

      setRole(profile?.role || 'staff')
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="container">Loading…</div>
  if (role === 'guest') return <GuestDashboard />
  if (role === 'admin') return <AdminDashboard />
  return <StaffDashboard />
}
