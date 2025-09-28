'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, LogOut } from 'lucide-react'
import type { Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ClientShell({
  profile,
  children,
}: {
  profile: Tables<'user_profile'>
  children: React.ReactNode
}) {
  const router = useRouter()
  const [mode, setMode] = useState(profile.map_style_pref === 'dark' ? 'dark' : 'light')

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', mode === 'dark')
    }
  }, [mode])

  const handleToggleMode = async () => {
    const nextMode = mode === 'dark' ? 'light' : 'dark'
    setMode(nextMode)
    await supabase
      .from('user_profile')
      .update({ map_style_pref: nextMode })
      .eq('user_id', profile.user_id)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/auth/sign-in')
  }

  return (
    <div
      className={cn(
        'min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 text-white',
        mode === 'light' && 'from-gray-50 via-white to-gray-100 text-gray-900'
      )}
    >
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/30 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-6 w-6 text-binbird-red" />
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-binbird-red">Client Portal</p>
              <p className="text-lg font-semibold">{profile.full_name ?? 'Client'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={handleToggleMode}>
              {mode === 'dark' ? 'Light mode' : 'Dark mode'}
            </Button>
            <Button variant="outline" onClick={() => router.push('/client')}>Dashboard</Button>
            <Button variant="destructive" onClick={handleSignOut} className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-8">
        {children}
      </main>
      <footer className="border-t border-white/10 bg-black/40 py-6 text-center text-sm text-white/60">
        BinBird © {new Date().getFullYear()} — Stay in sync with your bin days.
      </footer>
    </div>
  )
}
