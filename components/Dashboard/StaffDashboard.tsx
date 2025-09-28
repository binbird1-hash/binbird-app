'use client'
import Header from '../UI/Header'
import Card from '../UI/LegacyCard'
import { Users, Cog, FileText, KeyRound, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

export default function AdminDashboard() {
  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      {/* Header */}
      <Header title="Admin Console" />

      {/* Content */}
      <main className="flex-1 flex flex-col gap-4 px-6 py-6">
        <Card title="Ops Console" icon={Cog} href="/ops" />
        <Card title="Client List" icon={Users} href="/ops/clients" />
        <Card title="Logs & Proofs" icon={FileText} href="/ops/logs" />
        <Card title="Client Tokens" icon={KeyRound} href="/ops/tokens" />
        <Card title="Sign Out" icon={LogOut} onClick={signOut} />
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-white/40 py-4">
        © {new Date().getFullYear()} BinBird
      </footer>
    </div>
  )
}
