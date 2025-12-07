'use client'

import '@/app/globals.css'
import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { ClientPortalProvider, useClientPortal } from '@/components/client/ClientPortalProvider'
import { PortalNavigation } from '@/components/client/PortalNavigation'

function PortalScaffold({ children }: { children: ReactNode }) {
  const { loading, error } = useClientPortal()
  const pathname = usePathname()
  const isDashboard = pathname?.startsWith('/client/dashboard')

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-3xl border border-red-500/30 bg-red-50 p-8 text-center text-red-800">
          <h1 className="text-xl font-semibold">We could not load your portal</h1>
          <p className="mt-3 text-sm text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-6 py-3 text-slate-600 shadow-lg shadow-slate-200">
          <span className="h-2 w-2 animate-ping rounded-full bg-binbird-red" />
          Loading your portal…
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-slate-50 px-4 pb-24 pt-8 text-slate-900 sm:px-6 sm:pb-12 sm:pt-12 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 sm:gap-8">
        <PortalNavigation />
      </div>
      <div className="mx-auto mt-6 w-full max-w-6xl sm:mt-8">
        <div
          className={clsx(
            'rounded-3xl border border-slate-200 bg-white p-4 text-slate-900 sm:p-6',
            isDashboard && 'shadow-xl shadow-slate-200/60',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export default function ClientPortalLayout({ children }: { children: ReactNode }) {
  return (
    <ClientPortalProvider>
      <PortalScaffold>{children}</PortalScaffold>
    </ClientPortalProvider>
  )
}
