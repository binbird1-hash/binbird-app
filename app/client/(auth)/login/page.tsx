'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useSupabase } from '@/components/providers/SupabaseProvider'

export default function ClientLoginPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [staySignedIn, setStaySignedIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    if (staySignedIn) {
      localStorage.setItem('binbird-client-stay-signed-in', 'true')
    } else {
      localStorage.removeItem('binbird-client-stay-signed-in')
    }

    router.push('/client/dashboard')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold text-white">Sign in to BinBird</h2>
        <p className="text-sm text-white/60">
          Manage your properties, track service progress, and update team access.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="sr-only" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="Email"
            autoComplete="email"
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="sr-only" htmlFor="password">
            Password
          </label>
          <div className="flex items-center rounded-xl border border-white/20 bg-white/10 focus-within:border-binbird-red focus-within:ring-2 focus-within:ring-binbird-red/30">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              autoComplete="current-password"
              className="flex-1 rounded-xl bg-transparent px-4 py-3 text-base text-white placeholder:text-white/40 focus:outline-none"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              className="mr-3 rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
              onClick={() => setShowPassword((previous) => !previous)}
              aria-label={showPassword ? 'Hide password' : 'Toggle password visibility'}
            >
              {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex items-center gap-3 text-sm text-white/70">
          <input
            type="checkbox"
            checked={staySignedIn}
            onChange={(event) => setStaySignedIn(event.target.checked)}
            className="h-4 w-4 rounded border border-white/30 bg-transparent text-binbird-red focus:ring-binbird-red"
          />
          Stay signed in on this device
        </label>
        <Link className="text-sm font-medium text-binbird-red hover:text-binbird-red/80" href="/client/reset">
          Forgot password?
        </Link>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center rounded-xl bg-binbird-red px-4 py-3 text-base font-semibold text-white shadow-lg shadow-red-900/40 transition hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  )
}
