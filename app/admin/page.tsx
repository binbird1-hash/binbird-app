// app/admin/page.tsx
import { redirect } from 'next/navigation'
import AdminDashboard from '@/components/Dashboard/AdminDashboard'
import { supabaseServer } from '@/lib/supabaseServer'
import {
  normalizePortalRole,
  resolveHighestPriorityRole,
  resolveRoleFromMetadata,
} from '@/lib/roles'

export const metadata = {
  title: 'Admin Console',
}

export default async function AdminPage() {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const appMetadataRole = resolveRoleFromMetadata(user.app_metadata)

  if (appMetadataRole === 'admin') {
    return <AdminDashboard />
  }

  const metadataRole = resolveRoleFromMetadata(user.user_metadata)

  if (metadataRole === 'admin') {
    return <AdminDashboard />
  }

  const { data: profile, error } = await supabase
    .from('user_profile')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('Failed to load user role for admin page', error)
    redirect('/')
  }

  const profileRole = normalizePortalRole(profile?.role)
  const resolvedRole = resolveHighestPriorityRole(
    appMetadataRole,
    metadataRole,
    profileRole,
  )

  if (resolvedRole !== 'admin') {
    redirect('/')
  }

  return <AdminDashboard />
}
