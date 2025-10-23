// app/admin/page.tsx
import { redirect } from 'next/navigation'
import AdminDashboard from '@/components/Dashboard/AdminDashboard'
import { supabaseServer } from '@/lib/supabaseServer'

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

  const { data: profile, error } = await supabase
    .from('user_profile')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('Failed to load user role for admin page', error)
    redirect('/')
  }

  if (profile?.role !== 'admin') {
    redirect('/')
  }

  return <AdminDashboard />
}
