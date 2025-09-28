import { redirect } from 'next/navigation'
import { supabaseServer } from './supabaseServer'
import type { Tables } from './database.types'

export type Role = 'admin' | 'staff' | 'client'

export async function requireAuth(role?: Role) {
  const supabase = supabaseServer()
  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser()

  if (sessionError || !user) {
    redirect('/auth/sign-in')
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profile')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    throw profileError
  }

  if (!profile) {
    redirect('/auth/sign-in')
  }

  const normalizedRole = profile.role as Role | null

  if (role && normalizedRole !== role) {
    switch (normalizedRole) {
      case 'admin':
        redirect('/admin')
      case 'staff':
        redirect('/staff')
      case 'client':
        redirect('/client')
      default:
        redirect('/auth/sign-in')
    }
  }

  return {
    supabase,
    user,
    profile: profile as Tables<'user_profile'>,
  }
}

export async function getOptionalAuth() {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, user: null, profile: null }
  }

  const { data: profile } = await supabase
    .from('user_profile')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return {
    supabase,
    user,
    profile: (profile ?? null) as Tables<'user_profile'> | null,
  }
}
