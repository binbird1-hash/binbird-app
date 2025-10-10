"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/components/providers/SupabaseProvider'

export default function UnauthorizedPage() {
  const router = useRouter()
  const supabase = useSupabase()
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReturn() {
    setError(null)
    setSigningOut(true)

    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      setError('We could not end your session. Please try again.')
      setSigningOut(false)
      return
    }

    router.replace('/auth/sign-in')
  }

  return (
    <div className="space-y-4 text-center">
      <h2 className="text-2xl font-semibold text-white">Access denied</h2>
      <p className="text-sm text-white/60">
        You do not have permission to view this area. Please contact BinBird support if you believe this is a mistake.
      </p>
      {error ? <p className="text-sm text-red-200">{error}</p> : null}
      <button
        type="button"
        onClick={handleReturn}
        disabled={signingOut}
        className="inline-flex items-center justify-center rounded-xl bg-binbird-red px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {signingOut ? 'Signing you out…' : 'Return to sign in'}
      </button>
    </div>
  )
}
