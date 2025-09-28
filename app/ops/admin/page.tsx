// app/ops/admin/page.tsx
import BackButton from '@/components/UI/BackButton'
import { supabaseServer } from '@/lib/supabaseServer'
import { AdminConsole, type ClientAccount, type PropertyRecord, type ScheduleRecord, type WorkerRecord } from './AdminConsole'

export default async function AdminPage() {
  const sb = supabaseServer()

  const [userResult, clientsResult, propertiesResult, schedulesResult, workersResult] = await Promise.all([
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

  const {
    data: { user },
  } = userResult

  if (!user) {
    return (
      <div className="container">
        <BackButton />
        <h2 className="text-xl font-semibold">Admin access required</h2>
        <p className="mt-2 text-white/70">
          You need to sign in with an operations account to manage clients and properties.
        </p>
      </div>
    )
  }

  const errors: string[] = []
  if (clientsResult.error) errors.push(`Clients: ${clientsResult.error.message}`)
  if (propertiesResult.error) errors.push(`Properties: ${propertiesResult.error.message}`)
  if (schedulesResult.error) errors.push(`Schedules: ${schedulesResult.error.message}`)
  if (workersResult.error) errors.push(`Workers: ${workersResult.error.message}`)

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
        clients={(clientsResult.data ?? []) as ClientAccount[]}
        properties={(propertiesResult.data ?? []) as PropertyRecord[]}
        schedules={(schedulesResult.data ?? []) as ScheduleRecord[]}
        workers={(workersResult.data ?? []) as WorkerRecord[]}
        errors={errors}
      />
    </div>
  )
}

