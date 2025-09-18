'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function AuthPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function signUp() {
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) return setError(error.message)
    alert('Signed up! If email confirmation is enabled, check your inbox. Then ask admin to activate your account.')
  }

  async function signIn(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    // Keep button in "loading" until redirect is done
    router.push('/staff/run')
  }

  return (
    <form
      onSubmit={signIn}
      className="w-full flex flex-col gap-5"
    >
      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Email */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-[#ff5757]"
          required
        />
      </div>

      {/* Password */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
        <div className="flex w-full items-stretch rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-[#ff5757]">
          <input
            type={showPw ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-l-lg px-3 py-2 text-gray-900 outline-none"
            required
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="rounded-r-lg border-l px-3 text-sm text-gray-600 hover:text-gray-900"
            aria-label="Toggle password visibility"
          >
            {showPw ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {/* Sign in */}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[#ff5757] px-4 py-2 font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </button>

      {/* Sign up */}
      <p className="text-center text-sm text-gray-600">
        Don’t have an account?{' '}
        <button
          type="button"
          onClick={signUp}
          disabled={loading}
          className="font-semibold text-[#ff5757] hover:underline disabled:opacity-60"
        >
          Sign Up
        </button>
      </p>
    </form>
  )
}
