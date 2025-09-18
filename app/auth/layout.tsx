'use client'

import { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="flex flex-col gap-6">
          {/* Brand Logo */}
          <h1 className="text-3xl font-bold text-center" style={{ color: '#ff5757' }}>
            Welcome to BinBird!
          </h1>
          {children}
        </div>
      </div>
      <p className="mt-6 text-xs text-white/60">
        © {new Date().getFullYear()} BinBird
      </p>
    </div>
  )
}
