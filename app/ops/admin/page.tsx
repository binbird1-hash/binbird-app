// app/ops/admin/page.tsx
import BackButton from '@/components/UI/BackButton'
import { supabaseServer } from '@/lib/supabaseServer'
import { AdminConsole, type ClientAccount, type PropertyRecord, type ScheduleRecord, type WorkerRecord } from './AdminConsole'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminPage() {
  const sb = supabaseServer()

  const [userResult, clientsResult, propertiesResult, schedulesResult, workersResult] = await Promise.allSettled([
    sb.auth.getUser(),
    sb
      .from('client_accounts')
      .select('id, name, contact_email, contact_phone')
      .order('name', { ascending: true }),
    sb
      .from('property')
      .select('id, account_id, client_name, address, collection_day, put_bins_out, assigned_to')
      .order('client_name', { ascending: true }),
    sb.from('schedule').select('id, property_id, out_weekdays, in_weekdays'),
    sb
      .from('user_profile')
      .select('user_id, full_name, role')
      .in('role', ['staff', 'admin'])
      .order('full_name', { ascending: true }),
  ])

  const user =
    userResult.status === 'fulfilled'
      ? userResult.value.data.user
      : null

  if (!user) {
    const message =
      userResult.status === 'rejected'
        ? 'Unable to check your session. Please try again.'
        : 'You need to sign in with an operations account to manage clients and properties.'

    return (
      <div className="container">
        <BackButton />
        <h2 className="text-xl font-semibold">Admin access required</h2>
        <p className="mt-2 text-white/70">{message}</p>
      </div>
    )
  }

  const errors: string[] = []
  const clientsData = clientsResult.status === 'fulfilled' ? clientsResult.value : null
  const propertiesData = propertiesResult.status === 'fulfilled' ? propertiesResult.value : null
  const schedulesData = schedulesResult.status === 'fulfilled' ? schedulesResult.value : null
  const workersData = workersResult.status === 'fulfilled' ? workersResult.value : null

  if (clientsResult.status === 'rejected') {
    errors.push('Clients: Failed to load client accounts.')
  } else if (clientsData?.error) {
    errors.push(`Clients: ${clientsData.error.message}`)
  }

  if (propertiesResult.status === 'rejected') {
    errors.push('Properties: Failed to load properties.')
  } else if (propertiesData?.error) {
    errors.push(`Properties: ${propertiesData.error.message}`)
  }

  if (schedulesResult.status === 'rejected') {
    errors.push('Schedules: Failed to load schedules.')
  } else if (schedulesData?.error) {
    errors.push(`Schedules: ${schedulesData.error.message}`)
  }

  if (workersResult.status === 'rejected') {
    errors.push('Workers: Failed to load worker roster.')
  } else if (workersData?.error) {
    errors.push(`Workers: ${workersData.error.message}`)
  }

  return (
    <div className="container space-y-6 py-6">
      <BackButton />
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-white">Admin control centre</h1>
        <p className="text-sm text-white/70">
          Create clients, connect properties, configure bin schedules, and keep your crew assignments up to date — all from one
          place.
        </p>
      </header>

      <AdminConsole
        clients={(clientsData?.data ?? []) as ClientAccount[]}
        properties={(propertiesData?.data ?? []) as PropertyRecord[]}
        schedules={(schedulesData?.data ?? []) as ScheduleRecord[]}
        workers={(workersData?.data ?? []) as WorkerRecord[]}
        errors={errors}
      />
    </div>
  )
}

