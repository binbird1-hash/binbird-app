import type { SupabaseClient } from '@supabase/supabase-js'

export type UserRole = 'staff' | 'client' | 'admin'

const DESTINATION_BY_ROLE: Record<UserRole, string> = {
  staff: '/staff/dashboard',
  client: '/client/dashboard',
  admin: '/staff/dashboard',
}

function normalizeRole(role: unknown): UserRole | null {
  if (typeof role !== 'string') {
    return null
  }

  const normalized = role.trim().toLowerCase()

  if (normalized === 'staff' || normalized === 'client' || normalized === 'admin') {
    return normalized
  }

  return null
}

type RoleLookupParams = {
  userId?: string | null
  email?: string | null
}

export async function fetchRole(
  supabase: SupabaseClient,
  { userId, email }: RoleLookupParams,
): Promise<UserRole | null> {
  if (userId) {
    const { data, error } = await supabase
      .from('user_profile')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Failed to fetch user role by user id', error)
    }

    const normalized = normalizeRole(data?.role)

    if (normalized) {
      return normalized
    }
  }

  if (email) {
    const { data, error } = await supabase
      .from('user_profile')
      .select('role')
      .ilike('email', email)
      .maybeSingle()

    if (error) {
      console.error('Failed to fetch user role by email', error)
    }

    return normalizeRole(data?.role)
  }

  return null
}

export function getPortalDestination(role: UserRole | null) {
  if (!role) {
    return '/auth/unauthorized'
  }

  return DESTINATION_BY_ROLE[role]
}
