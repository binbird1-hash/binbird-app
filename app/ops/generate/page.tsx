// app/ops/generate/page.tsx
import BackButton from '@/components/UI/BackButton'
import { supabaseServer } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import { getOperationalDayIndex, getOperationalDayName } from '@/lib/date'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

const DAY_ALIASES: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  weds: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
}

type ClientListRow = {
  property_id: string
  account_id: string | null
  client_name: string | null
  company: string | null
  address: string | null
  collection_day: string | null
  put_bins_out: string | null
  notes: string | null
  assigned_to: string | null
  lat_lng: string | null
  photo_path: string | null
  red_freq: string | null
  red_flip: string | null
  yellow_freq: string | null
  yellow_flip: string | null
  green_freq: string | null
  green_flip: string | null
}

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

const tokensFor = (value: string | null | undefined) =>
  (value ?? '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean)

const parseDayIndex = (value: string | null | undefined): number | null => {
  const tokens = tokensFor(value)
  for (const token of tokens) {
    const idx = DAY_ALIASES[token]
    if (idx !== undefined) {
      return idx
    }
  }
  return null
}

const matchesDay = (value: string | null, dayIndex: number): boolean =>
  tokensFor(value).some((token) => DAY_ALIASES[token] === dayIndex)

const parseLatLng = (value: string | null): { lat: number | null; lng: number | null } => {
  if (!value) return { lat: null, lng: null }
  const [latRaw, lngRaw] = value.split(',').map((part) => Number.parseFloat(part.trim()))
  return {
    lat: Number.isFinite(latRaw) ? latRaw : null,
    lng: Number.isFinite(lngRaw) ? lngRaw : null,
  }
}

const describeBinFrequency = (
  label: string,
  frequency: string | null,
  flip: string | null,
) => {
  if (!frequency) return null
  const base = `${label} (${frequency.toLowerCase()})`
  if (frequency === 'Fortnightly' && flip === 'Yes') {
    return `${base}, alternate weeks`
  }
  return base
}

const deriveAccountId = (row: ClientListRow): string =>
  row.account_id && row.account_id.trim().length ? row.account_id.trim() : row.property_id

const deriveClientName = (row: ClientListRow): string =>
  row.client_name?.trim() || row.company?.trim() || 'Client'

const buildBinsSummary = (row: ClientListRow): string | null => {
  const bins = [
    describeBinFrequency('Garbage', row.red_freq, row.red_flip),
    describeBinFrequency('Recycling', row.yellow_freq, row.yellow_flip),
    describeBinFrequency('Organic', row.green_freq, row.green_flip),
  ].filter(Boolean) as string[]

  if (!bins.length) return null
  return bins.join(', ')
}

async function generateJobs() {
  'use server'
  const sb = supabaseServer()
  const override = process.env.NEXT_PUBLIC_DEV_DAY_OVERRIDE ?? null
  const overrideIndex = parseDayIndex(override)

  const operationalIndex = getOperationalDayIndex()
  const dayIndex = overrideIndex ?? operationalIndex
  const dayName =
    overrideIndex !== null ? DAY_NAMES[dayIndex] : getOperationalDayName()

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

  const rows = (clients ?? []) as ClientListRow[]

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
