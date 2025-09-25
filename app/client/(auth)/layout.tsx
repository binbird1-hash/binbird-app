import '@/app/globals.css'
import type { ReactNode } from 'react'

export default function ClientAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-red-900 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 py-12">
        <div className="w-full rounded-3xl border border-white/10 bg-black/70 p-8 shadow-2xl backdrop-blur">
          <div className="mb-8 text-center">
            <p className="text-sm uppercase tracking-[0.35em] text-white/60">BinBird Client Portal</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Welcome back</h1>
          </div>
          {children}
        </div>
        <p className="mt-8 text-center text-xs text-white/40">
          Need staff access? <a className="font-medium text-binbird-red underline-offset-4 hover:underline" href="/auth/sign-in">Sign in here</a>.
        </p>
      </div>
    </div>
  )
}
