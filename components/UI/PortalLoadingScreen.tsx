'use client'

import type { ReactNode } from 'react'

interface PortalLoadingScreenProps {
  message?: ReactNode
}

export function PortalLoadingScreen({ message = 'Loading your portal…' }: PortalLoadingScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-gray-950 to-red-950 px-4">
      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/70 px-6 py-3 text-white/70 shadow-lg shadow-black/30">
        <span className="h-2 w-2 animate-ping rounded-full bg-binbird-red" />
        {message}
      </div>
    </div>
  )
}
