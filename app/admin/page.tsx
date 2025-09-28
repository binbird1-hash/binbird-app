import { requireAuth } from '@/lib/auth'
import { AdminPortal } from '@/components/admin/admin-portal'
import type { Tables } from '@/lib/database.types'

export default async function AdminPage() {
  const { supabase, profile } = await requireAuth('admin')

  const [{ data: clientRows = [] }, { data: jobRows = [] }, { data: logRows = [] }, { data: userRows = [] }] =
    await Promise.all([
      supabase.from('client_list').select('*'),
      supabase.from('jobs').select('*'),
      supabase.from('logs').select('*'),
      supabase.from('user_profile').select('*'),
    ])

  return (
    <AdminPortal
      data={{
        profile,
        clients: clientRows as Tables<'client_list'>[],
        jobs: jobRows as Tables<'jobs'>[],
        logs: logRows as Tables<'logs'>[],
        users: userRows as Tables<'user_profile'>[],
      }}
    />
  )
}
