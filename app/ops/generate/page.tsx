// app/ops/generate/page.tsx
import BackButton from '@/components/UI/BackButton'
import { supabaseServer } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import {
  buildBinsSummary,
  deriveAccountId,
  deriveClientName,
  getJobGenerationDayInfo,
  matchesDay,
  parseLatLng,
  type JobSourceClientRow,
} from '@/lib/jobGeneration'

type NewJobRow = {
  account_id: string
  property_id: string | null
  address: string
  lat: number | null
  lng: number | null
  job_type: 'put_out' | 'bring_in'
  bins: string | null
  notes: string | null
  client_name: string | null
  photo_path: string | null
  assigned_to: string | null
  day_of_week: string
  last_completed_on: null
}

async function generateJobs() {
  'use server'
  const sb = await supabaseServer()
  const { dayIndex, dayName } = getJobGenerationDayInfo()

  const { data: clients, error: clientError } = await sb
    .from('client_list')
    .select(
      `property_id, account_id, client_name, company, address, collection_day, put_bins_out, notes, assigned_to, lat_lng, photo_path, red_freq, red_flip, yellow_freq, yellow_flip, green_freq, green_flip`,
    )

  if (clientError) {
    console.error('Error fetching clients:', clientError.message)
    const params = new URLSearchParams({
      status: 'error',
      message: 'Failed to load client schedules.',
    })
    redirect(`/ops/generate?${params.toString()}`)
  }

  const rows = (clients ?? []) as JobSourceClientRow[]

  const jobs: NewJobRow[] = []
  for (const client of rows) {
    const accountId = deriveAccountId(client)
    const clientName = deriveClientName(client)
    const { lat, lng } = parseLatLng(client.lat_lng)
    const bins = buildBinsSummary(client)
    const address = client.address?.trim() ?? ''

    if (matchesDay(client.put_bins_out, dayIndex)) {
      jobs.push({
        account_id: accountId,
        property_id: client.property_id,
        address,
        lat,
        lng,
        job_type: 'put_out',
        bins,
        notes: client.notes,
        client_name: clientName,
        photo_path: client.photo_path,
        assigned_to: client.assigned_to,
        day_of_week: dayName,
        last_completed_on: null,
      })
    }

    if (matchesDay(client.collection_day, dayIndex)) {
      jobs.push({
        account_id: accountId,
        property_id: client.property_id,
        address,
        lat,
        lng,
        job_type: 'bring_in',
        bins,
        notes: client.notes,
        client_name: clientName,
        photo_path: client.photo_path,
        assigned_to: client.assigned_to,
        day_of_week: dayName,
        last_completed_on: null,
      })
    }
  }

  if (!jobs.length) {
    const params = new URLSearchParams({
      status: 'success',
      message: `No jobs scheduled for ${dayName}.`,
    })
    redirect(`/ops/generate?${params.toString()}`)
  }

  const { error: deleteError } = await sb
    .from('jobs')
    .delete()
    .eq('day_of_week', dayName)
    .is('last_completed_on', null)

  if (deleteError) {
    console.error('Error clearing existing jobs:', deleteError.message)
    const params = new URLSearchParams({
      status: 'error',
      message: 'Failed to clear existing jobs for today.',
    })
    redirect(`/ops/generate?${params.toString()}`)
  }

  const { error: insertError } = await sb.from('jobs').insert(jobs)

  if (insertError) {
    console.error('Error inserting jobs:', insertError.message)
    const params = new URLSearchParams({
      status: 'error',
      message: 'Failed to generate jobs for today.',
    })
    redirect(`/ops/generate?${params.toString()}`)
  }

  const params = new URLSearchParams({
    status: 'success',
    message: `Generated ${jobs.length} job${jobs.length === 1 ? '' : 's'} for ${dayName}.`,
  })
  redirect(`/ops/generate?${params.toString()}`)
}

type GeneratePageProps = {
  searchParams?: {
    status?: string
    message?: string
  }
}

export default function Generate({ searchParams }: GeneratePageProps) {
  const status = searchParams?.status
  const message = searchParams?.message
  const isSuccess = status === 'success'
  const alertClass = isSuccess ? 'text-green-600' : 'text-red-600'

  return (
    <div className="container space-y-4">
      <BackButton />
      <h3 className="text-xl font-semibold">Generate Today&apos;s Jobs</h3>
      {status && message ? (
        <p className={`text-sm ${alertClass}`} role="status">
          {message}
        </p>
      ) : null}
      <form action={generateJobs}>
        <button className="btn" type="submit">
          Generate
        </button>
      </form>
    </div>
  )
}
