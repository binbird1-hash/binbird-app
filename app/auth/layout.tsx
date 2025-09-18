// app/auth/layout.tsx
'use client'

import { ReactNode } from 'react'

type AuthLayoutProps = {
  children: ReactNode
  title?: string   // optional heading
}

export default function AuthLayout({ children, title }: AuthLayoutProps) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
          {title && (
            <div className="w-full">
              <h1 className="text-2xl sm:text-[26px] font-bold text-center mb-6 text-[#ff5757] whitespace-nowrap">
                {title}
              </h1>
            </div>
          )}
        {children}
      </div>
      <p className="mt-6 text-xs text-white/60">© {new Date().getFullYear()} BinBird</p>
    </div>
  )
}
