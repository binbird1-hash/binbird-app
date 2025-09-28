import type { ReactNode } from 'react'
import { requireAuth } from '@/lib/auth'
import { ClientShell } from '@/components/client/client-shell'

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireAuth('client')

  return <ClientShell profile={profile}>{children}</ClientShell>
}
