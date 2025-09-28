import type { ReactNode } from 'react'
import { requireAuth } from '@/lib/auth'
import { AdminShell } from '@/components/admin/admin-shell'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireAuth('admin')
  return <AdminShell profile={profile}>{children}</AdminShell>
}
