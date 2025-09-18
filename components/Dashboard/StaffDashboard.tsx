'use client'
import Header from '../UI/Header'
import Card from '../UI/Card'
import { LogOut, ClipboardCheck, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

export default function StaffDashboard() {
  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="wrap">
      <Header title="Staff Dashboard" />
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Today's Jobs" icon={ClipboardCheck} href="/staff/today" />
        <Card title="Completed Jobs" icon={CheckCircle} href="/staff/history" />
        <Card title="Sign Out" icon={LogOut} onClick={signOut} />
      </div>
    </div>
  )
}
