'use client'
import Header from '../UI/Header'
import Card from '../UI/Card'
import { Users, Cog, FileText, KeyRound, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

export default function AdminDashboard() {
  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="wrap">
      <Header title="Admin Console" />
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Ops Console" icon={Cog} href="/ops" />
        <Card title="Client List" icon={Users} href="/ops/clients" />
        <Card title="Logs & Proofs" icon={FileText} href="/ops/logs" />
        <Card title="Client Tokens" icon={KeyRound} href="/ops/tokens" />
        <Card title="Sign Out" icon={LogOut} onClick={signOut} />
      </div>
    </div>
  )
}
