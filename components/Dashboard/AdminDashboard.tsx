'use client'
import Header from '../UI/Header'
import Card from '../UI/Card'
import { Users, Cog, FileText, LogOut, ClipboardCheck } from 'lucide-react'
import { useSupabase } from '@/components/providers/SupabaseProvider'

export default function AdminDashboard() {
  const supabase = useSupabase()
  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-white text-black px-6 py-8">
      <Header title="Admin Console" />
      <div className="grid gap-4 sm:grid-cols-2 mt-6">
        <Card title="Admin Portal" icon={Cog} href="/admin" />
        <Card title="Property List" icon={Users} href="/admin/clients" />
        <Card title="Jobs & Assignments" icon={ClipboardCheck} href="/admin/jobs" />
        <Card title="Logs & Proofs" icon={FileText} href="/admin/logs" />
        <Card title="Sign Out" icon={LogOut} onClick={signOut} />
      </div>
    </div>
  )
}
