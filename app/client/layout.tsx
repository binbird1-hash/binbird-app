import type { ReactNode } from 'react'
import Link from 'next/link'

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/client/dashboard" className="text-lg font-semibold tracking-[0.3em] uppercase text-white">
            BinBird Client
          </Link>
          <nav className="flex items-center gap-4 text-sm text-white/70">
            <Link href="/client/dashboard" className="hover:text-white">
              Dashboard
            </Link>
            <Link href="/staff/dashboard" className="hover:text-white">
              Staff tools
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
    </div>
  )
}
