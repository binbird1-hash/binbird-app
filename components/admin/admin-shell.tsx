'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, Building2, ClipboardCheck, FileText, Settings, Users, MapPin, UserCog } from 'lucide-react'
import type { Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: BarChart3 },
  { href: '#properties', label: 'Properties', icon: Building2 },
  { href: '#jobs', label: 'Jobs', icon: ClipboardCheck },
  { href: '#proofs', label: 'Proofs', icon: FileText },
  { href: '#clients', label: 'Clients', icon: Users },
  { href: '#staff', label: 'Staff', icon: UserCog },
  { href: '#users', label: 'Users', icon: MapPin },
  { href: '#settings', label: 'Settings', icon: Settings },
]

export function AdminShell({
  profile,
  children,
}: {
  profile: Tables<'user_profile'>
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1024px)')
    const handler = (event: MediaQueryListEvent | MediaQueryList) => setCollapsed(event.matches)
    handler(media)
    media.addEventListener('change', handler as any)
    return () => media.removeEventListener('change', handler as any)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/auth/sign-in')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 text-white">
      <div className="mx-auto flex w-full max-w-7xl gap-8 px-6 py-8">
        <aside
          className={cn(
            'sticky top-6 h-[calc(100vh-3rem)] w-64 flex-shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur lg:block',
            collapsed && 'hidden'
          )}
        >
          <div className="mb-8">
            <p className="text-sm font-semibold text-binbird-red">BinBird Admin</p>
            <h2 className="text-2xl font-bold">{profile.full_name ?? 'Admin'}</h2>
            <p className="text-xs text-white/50">{profile.email}</p>
          </div>
          <nav className="flex flex-col gap-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href
              return item.href.startsWith('#') ? (
                <a
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition hover:bg-white/10',
                    active ? 'bg-white/10 text-white' : 'text-white/60'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition hover:bg-white/10',
                    active ? 'bg-white/10 text-white' : 'text-white/60'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <Button className="mt-10 w-full" variant="destructive" onClick={handleSignOut}>
            Sign out
          </Button>
        </aside>
        <div className="flex-1">
          <header className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Operations Control</h1>
              <p className="text-sm text-white/60">Real-time overview of clients, routes, and staff performance.</p>
            </div>
            <Button className="lg:hidden" variant="ghost" onClick={() => setCollapsed((prev) => !prev)}>
              {collapsed ? 'Open menu' : 'Hide menu'}
            </Button>
          </header>
          <div className="space-y-16">{children}</div>
        </div>
      </div>
    </div>
  )
}
