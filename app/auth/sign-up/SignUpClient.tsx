"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/components/providers/SupabaseProvider'

type SignupRole = 'staff' | 'client'

export default function SignUpClient() {
  const supabase = useSupabase()
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState<SignupRole>('client')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function toggleRole(role: SignupRole) {
    setSelectedRole(role)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    const userId = data.user?.id ?? null

    if (userId) {
      const { error: profileError } = await supabase
        .from('user_profile')
        .upsert({
          user_id: userId,
          full_name: fullName,
          phone,
          role: selectedRole,
          email,
        })
        .select()

      if (profileError) {
        setError('Account created, but we could not finish setting up your profile. Please contact support.')
        setLoading(false)
        return
      }
    }

    const destination = selectedRole === 'staff' ? '/staff/dashboard' : '/client/dashboard'

    if (data.session) {
      setLoading(false)
      router.push(destination)

      if (typeof window !== 'undefined') {
        window.location.assign(destination)
      }

      return
    }

    const { error: immediateSignInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (!immediateSignInError) {
      setLoading(false)
      router.push(destination)

      if (typeof window !== 'undefined') {
        window.location.assign(destination)
      }

      return
    }

    setMessage('Check your email to confirm your account, then sign in to continue.')
    setLoading(false)
    setTimeout(() => {
      router.push('/auth/sign-in')
    }, 2000)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold text-white">Create your BinBird account</h2>
        <p className="text-sm text-white/60">Choose whether you need staff tools or client access.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="sr-only" htmlFor="signup-name">
            Name
          </label>
          <input
            id="signup-name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            placeholder="Name"
            aria-label="Name"
          />
        </div>

        <div className="space-y-2">
          <label className="sr-only" htmlFor="signup-phone">
            Phone number
          </label>
          <input
            id="signup-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
            className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            placeholder="Phone number"
            aria-label="Phone number"
          />
        </div>

        <div className="space-y-2">
          <label className="sr-only" htmlFor="signup-email">
            Email
          </label>
          <input
            id="signup-email"
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
          <label className="sr-only" htmlFor="signup-password">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            placeholder="Password"
            aria-label="Password"
          />
        </div>

        <div className="space-y-2">
          <label className="sr-only" htmlFor="signup-confirm-password">
            Confirm password
          </label>
          <input
            id="signup-confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            placeholder="Confirm password"
            aria-label="Confirm password"
          />
        </div>

        {error ? <p className="text-sm text-red-200">{error}</p> : null}
        {message ? <p className="text-sm text-green-200">{message}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition ${
              selectedRole === 'client'
                ? 'border-binbird-red bg-binbird-red/10 text-white'
                : 'border-white/10 bg-white/5 text-white/80'
            }`}
          >
            <span>Client access</span>
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={selectedRole === 'client'}
              onChange={() => toggleRole('client')}
            />
          </label>
          <label
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition ${
              selectedRole === 'staff'
                ? 'border-binbird-red bg-binbird-red/10 text-white'
                : 'border-white/10 bg-white/5 text-white/80'
            }`}
          >
            <span>Staff tools</span>
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={selectedRole === 'staff'}
              onChange={() => toggleRole('staff')}
            />
          </label>
        </div>

        <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
          {selectedRole === 'staff' ? 'Staff Access' : 'Client Access'}
        </p>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-xl bg-binbird-red px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-center text-sm text-white/50">
        Already registered?{' '}
        <Link href="/auth/sign-in" className="font-semibold text-binbird-red hover:underline">
          Sign in instead
        </Link>
      </p>
    </div>
  )
}
