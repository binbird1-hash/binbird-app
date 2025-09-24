'use client'

import Header from '../UI/Header'
import Card from '../UI/Card'
import { Users, Cog, FileText, KeyRound, LogOut } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

type DashboardLink = {
  key: string
  title: string
  icon: LucideIcon
  href?: string
}

const DEFAULT_LINKS: DashboardLink[] = [
  { key: 'ops', title: 'Ops Console', icon: Cog, href: '/ops' },
  { key: 'clients', title: 'Client List', icon: Users, href: '/ops/clients' },
  { key: 'logs', title: 'Logs & Proofs', icon: FileText, href: '/ops/logs' },
  { key: 'tokens', title: 'Client Tokens', icon: KeyRound, href: '/ops/tokens' }
]

async function signOut() {
  await supabase.auth.signOut()
  window.location.href = '/'
}

export type DashboardVariant = 'light' | 'dark'

export function DashboardView({
  title,
  variant,
  links = DEFAULT_LINKS,
  showFooter = false
}: {
  title: string
  variant: DashboardVariant
  links?: DashboardLink[]
  showFooter?: boolean
}) {
  const handleSignOutClick = () => {
    void signOut()
  }

  const cards = links.map((link) => (
    <Card
      key={link.key}
      title={link.title}
      icon={link.icon}
      href={link.href}
    />
  ))

  cards.push(
    <Card key="sign-out" title="Sign Out" icon={LogOut} onClick={handleSignOutClick} />
  )

  if (variant === 'dark') {
    return (
      <div className="flex flex-col min-h-screen bg-black text-white">
        <Header title={title} />
        <main className="flex-1 flex flex-col gap-4 px-6 py-6">{cards}</main>
        {showFooter && (
          <footer className="text-center text-xs text-white/40 py-4">
            © {new Date().getFullYear()} BinBird
          </footer>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-black px-6 py-8">
      <Header title={title} />
      <div className="grid gap-4 sm:grid-cols-2 mt-6">{cards}</div>
    </div>
  )
}

export default function AdminDashboard() {
  return <DashboardView title="Admin Console" variant="light" />
}
