import type { SupabaseClient } from '@supabase/supabase-js'

export type UserRole = 'staff' | 'client' | 'admin'

const DESTINATION_BY_ROLE: Record<UserRole, string> = {
  staff: '/staff/dashboard',
  client: '/client/dashboard',
  admin: '/staff/dashboard',
}

export async function fetchRoleForEmail(supabase: SupabaseClient, email: string) {
  const { data, error } = await supabase
    .from('user_profile')
    .select('role')
    .eq('email', email)
    .maybeSingle()

  if (error) {
    console.error('Failed to fetch user role', error)
  }

  return (data?.role ?? null) as UserRole | null
}

export function getPortalDestination(role: UserRole | null) {
  if (!role) {
    return '/auth/unauthorized'
  }

  return DESTINATION_BY_ROLE[role]
}
