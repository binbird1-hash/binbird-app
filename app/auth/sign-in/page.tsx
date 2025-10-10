"use client"

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/components/providers/SupabaseProvider'

type UserRole = 'staff' | 'client' | 'admin'

function getPortalDestination(role: UserRole | null): string {
  if (role === 'staff' || role === 'admin') {
    return '/staff/dashboard'
  }
  if (role === 'client') {
    return '/client/dashboard'
  }
  return '/auth/unauthorized'
}

export default function UnifiedSignInPage() {
  const router = useRouter()
  const supabase = useSupabase()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [stayLoggedIn, setStayLoggedIn] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }

    return window.localStorage.getItem('binbird-auth-persist') !== 'false'
  })

  const authStorageKey = useMemo(() => {
    if (typeof window === 'undefined') {
      return null
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (!url) {
      return null
    }

    try {
      const hostname = new URL(url).hostname.split('.')[0]
      return `sb-${hostname}-auth-token`
    } catch (error_) {
      console.error('Failed to derive Supabase storage key', error_)
      return null
    }
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    const user = signInData.user

    if (!user) {
      setError('We could not sign you in. Please try again.')
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profile')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError || !profile?.role) {
      setLoading(false)
      router.replace('/auth/unauthorized')
      router.refresh()
      return
    }

    const destination = getPortalDestination(profile.role as UserRole)

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('binbird-auth-persist', stayLoggedIn ? 'true' : 'false')

      if (!stayLoggedIn && authStorageKey) {
        window.localStorage.removeItem(authStorageKey)
      }
    }

    setLoading(false)
    router.replace(destination)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold text-white">Welcome back</h2>
        <p className="text-sm text-white/60">
          Enter your email and password to access your BinBird dashboard.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="sr-only" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            placeholder="Email"
            aria-label="Email"
          />
        </div>

        <div className="space-y-2">
          <label className="sr-only" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            placeholder="Password"
            aria-label="Password"
          />
        </div>

        <div className="flex items-center justify-between text-sm text-white/70">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border border-white/30 bg-white/10"
              checked={stayLoggedIn}
              onChange={(event) => setStayLoggedIn(event.target.checked)}
            />
            <span>Stay logged in</span>
          </label>
        </div>

        {error ? <p className="text-sm text-red-200">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-xl bg-binbird-red px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-center text-sm text-white/50">
        Don&apos;t have an account?{' '}
        <Link href="/auth/sign-up" className="font-semibold text-binbird-red hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  )
}
