'use client'

import '@/app/globals.css'
import type { ReactNode } from 'react'
import { ClientPortalProvider, useClientPortal } from '@/components/client/ClientPortalProvider'
import { PortalNavigation } from '@/components/client/PortalNavigation'
import { PortalHeader } from '@/components/client/PortalHeader'

function PortalScaffold({ children }: { children: ReactNode }) {
  const { loading, error } = useClientPortal()

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="max-w-md rounded-3xl border border-red-500/40 bg-red-500/10 p-8 text-center text-red-100">
          <h1 className="text-xl font-semibold">We could not load your portal</h1>
          <p className="mt-3 text-sm text-red-200/80">{error}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="flex items-center gap-3 rounded-full border border-white bg-black/70 px-6 py-3 text-white/70">
          <span className="h-2 w-2 animate-ping rounded-full bg-binbird-red" />
          Loading your portal…
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-black px-4 pb-24 pt-8 text-white sm:px-6 sm:pb-12 sm:pt-12 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 sm:gap-8">
        <PortalHeader />
        <PortalNavigation />
      </div>
      <div className="mx-auto mt-6 w-full max-w-6xl sm:mt-8">
        <div className="rounded-3xl border border-white bg-black/80 p-4 text-white backdrop-blur sm:p-6">
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
