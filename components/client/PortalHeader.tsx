'use client'

import { useMemo } from 'react'
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { useClientPortal } from './ClientPortalProvider'
import { AccountSwitcher } from './AccountSwitcher'
import { useSupabase } from '@/components/providers/SupabaseProvider'

export function PortalHeader() {
  const supabase = useSupabase()
  const { profile, user } = useClientPortal()
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl shadow-slate-200/70 backdrop-blur-lg sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <p className="text-sm uppercase tracking-[0.45em] text-slate-500">{greeting}</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          {profile?.fullName ?? user?.email ?? 'BinBird Client'}
        </h1>
        {profile?.companyName && <p className="text-sm text-slate-600">{profile.companyName}</p>}
      </div>
      <div className="flex flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
        <AccountSwitcher />
        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-binbird-red hover:bg-binbird-red/10 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red sm:w-auto"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5" />
          Sign out
        </button>
      </div>
    </header>
  )
}
