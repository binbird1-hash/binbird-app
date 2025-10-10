import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-6 py-12">
        <div className="mb-10 space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-white/60">BinBird App Access</p>
          <h1 className="text-3xl font-semibold text-white">Sign in to continue</h1>
          <p className="text-sm text-white/60">
            Use your BinBird credentials to access the staff tools or the client experience from one secure login.
          </p>
        </div>
        <div className="w-full rounded-3xl border border-white/10 bg-black/70 p-8 shadow-2xl shadow-black/50 backdrop-blur">
          {children}
        </div>
        <p className="mt-4 text-center text-[10px] uppercase tracking-[0.3em] text-white/30">
          © {new Date().getFullYear()} BinBird
        </p>
      </div>
    </div>
  )
}
