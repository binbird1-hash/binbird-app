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
      <div className="flex min-h-screen items-center justify-center bg-black px-4 [background-image:radial-gradient(circle_at_top,_#161616,_#000000)]">
        <div className="max-w-md rounded-3xl border border-red-500/40 bg-red-500/10 p-8 text-center text-red-100">
          <h1 className="text-xl font-semibold">We could not load your portal</h1>
          <p className="mt-3 text-sm text-red-200/80">{error}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4 [background-image:radial-gradient(circle_at_top,_#161616,_#000000)]">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/70 px-6 py-3 text-white/70 shadow-lg shadow-black/30">
          <span className="h-2 w-2 animate-ping rounded-full bg-binbird-red" />
          Loading your portal…
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-black px-4 py-10 text-white [background-image:radial-gradient(circle_at_top,_#161616,_#000000)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <PortalHeader />
        <PortalNavigation />
      </div>
      <div className="mx-auto mt-8 w-full max-w-6xl">
        <div className="rounded-3xl border border-white/10 bg-black/80 p-6 text-white shadow-2xl shadow-black/25 backdrop-blur">
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
