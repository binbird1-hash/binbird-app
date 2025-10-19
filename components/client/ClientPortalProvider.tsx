'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Session, User } from '@supabase/supabase-js'
import { normaliseBinList } from '@/lib/binLabels'
import { useSupabase } from '@/components/providers/SupabaseProvider'
import {
  addMinutes,
  differenceInMinutes,
  formatISO,
  nextDay,
  setHours,
  setMinutes,
  startOfToday,
  subMonths,
} from 'date-fns'
import type { Day } from 'date-fns'

export type ClientAccountRole = 'owner' | 'manager' | 'viewer'

export type ClientAccount = {
  id: string
  name: string
  role: ClientAccountRole
  propertyIds: string[]
}

export type Property = {
  id: string
  name: string
  addressLine: string
  suburb: string
  city: string
  status: 'active' | 'paused'
  binTypes: string[]
  binCounts: {
    garbage: number
    recycling: number
    compost: number
    total: number
  }
  binDescriptions: {
    garbage: string | null
    recycling: string | null
    compost: string | null
  }
  binFlips: {
    garbage: boolean
    recycling: boolean
    compost: boolean
  }
  nextServiceAt: string | null
  latitude: number | null
  longitude: number | null
  pricePerMonth: number | null
  trialStart: string | null
  membershipStart: string | null
  notes: string | null
  putOutDay: string | null
  collectionDay: string | null
}

export type JobStatus = 'scheduled' | 'en_route' | 'on_site' | 'completed' | 'skipped'

export type Job = {
  id: string
  accountId: string
  propertyId: string | null
  propertyName: string
  status: JobStatus
  scheduledAt: string
  etaMinutes?: number | null
  startedAt?: string | null
  arrivedAt?: string | null
  completedAt?: string | null
  crewName?: string | null
  proofPhotoKeys?: string[] | null
  proofUploadedAt?: string | null
  routePolyline?: string | null
  lastLatitude?: number | null
  lastLongitude?: number | null
  notes?: string | null
  jobType?: string | null
  bins?: string[]
  statusUpdatedAt?: string | null
}

export type NotificationPreferences = {
  accountId: string
  userId: string
  emailRouteUpdates: boolean
  pushRouteUpdates: boolean
  emailBilling: boolean
  pushBilling: boolean
  emailPropertyAlerts: boolean
  pushPropertyAlerts: boolean
}

export type ClientProfile = {
  id: string
  fullName: string
  phone: string | null
  companyName: string | null
  timezone: string | null
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
  red_freq: string | null
  red_flip: string | null
  red_bins: number | string | null
  yellow_freq: string | null
  yellow_flip: string | null
  yellow_bins: number | string | null
  green_freq: string | null
  green_flip: string | null
  green_bins: number | string | null
  email: string | null
  assigned_to: string | null
  lat_lng: string | null
  price_per_month: number | null
  photo_path: string | null
  trial_start: string | null
  membership_start: string | null
}

type NotificationMetadata = {
  [accountId: string]: {
    emailRouteUpdates?: boolean
    pushRouteUpdates?: boolean
    emailBilling?: boolean
    pushBilling?: boolean
    emailPropertyAlerts?: boolean
    pushPropertyAlerts?: boolean
  }
}

export type ClientPortalContextValue = {
  session: Session | null
  user: User | null
  profile: ClientProfile | null
  accounts: ClientAccount[]
  selectedAccount: ClientAccount | null
  selectAccount: (accountId: string) => void
  properties: Property[]
  propertiesLoading: boolean
  refreshProperties: () => Promise<void>
  jobHistory: Job[]
  jobs: Job[]
  jobsLoading: boolean
  refreshJobs: () => Promise<void>
  upsertJob: (job: Partial<Job> & { id: string }) => void
  notificationPreferences: NotificationPreferences | null
  preferencesLoading: boolean
  refreshNotificationPreferences: () => Promise<void>
  loading: boolean
  error: string | null
}

const ClientPortalContext = createContext<ClientPortalContextValue | undefined>(undefined)

const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  accountId: 'primary',
  userId: 'unknown',
  emailRouteUpdates: true,
  pushRouteUpdates: true,
  emailBilling: true,
  pushBilling: false,
  emailPropertyAlerts: true,
  pushPropertyAlerts: true,
}

const WEEKDAY_LOOKUP: Record<string, Day> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

const parseLatLng = (value: string | null): { lat: number | null; lng: number | null } => {
  if (!value) return { lat: null, lng: null }
  const [latRaw, lngRaw] = value.split(',').map((part) => Number.parseFloat(part.trim()))
  return {
    lat: Number.isFinite(latRaw) ? latRaw : null,
    lng: Number.isFinite(lngRaw) ? lngRaw : null,
  }
}

const normaliseAddress = (address: string | null | undefined) => address?.trim().toLowerCase() ?? ''

const normaliseIdentifier = (value: string | number | null | undefined): string | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return String(value)
  }
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const parseDateToIso = (value: string | null | undefined): string | null => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

const JOB_STATUS_PRIORITY: Record<JobStatus, number> = {
  scheduled: 0,
  en_route: 1,
  on_site: 2,
  completed: 3,
  skipped: 4,
}

const normaliseJobStatus = (value: string | null | undefined): JobStatus | null => {
  if (!value) return null
  const normalised = value.trim().toLowerCase().replace(/[-\s]/g, '_')
  if (!normalised.length) return null

  switch (normalised) {
    case 'scheduled':
    case 'pending':
      return 'scheduled'
    case 'en_route':
    case 'enroute':
    case 'start':
    case 'started':
    case 'start_run':
    case 'starting':
    case 'departed':
    case 'in_transit':
      return 'en_route'
    case 'on_site':
    case 'onsite':
    case 'arrived':
    case 'arrival':
    case 'arrived_at_location':
    case 'onlocation':
      return 'on_site'
    case 'completed':
    case 'done':
    case 'finished':
    case 'marked_done':
      return 'completed'
    case 'skipped':
    case 'cancelled':
    case 'canceled':
      return 'skipped'
    default:
      return null
  }
}

const extractStatusFromPayload = (payload: Record<string, unknown> | null | undefined): JobStatus | null => {
  if (!payload) return null
  const candidateKeys = ['status', 'new_status', 'action', 'event', 'type', 'transition']
  for (const key of candidateKeys) {
    if (key in payload) {
      const value = payload[key]
      if (typeof value === 'string') {
        const status = normaliseJobStatus(value)
        if (status) return status
      }
    }
  }
  return null
}

const extractProgressTimestamp = (payload: Record<string, unknown> | null | undefined): string | null => {
  if (!payload) return null
  const candidateKeys = ['occurred_at', 'created_at', 'updated_at', 'inserted_at', 'timestamp', 'event_at']
  for (const key of candidateKeys) {
    if (key in payload) {
      const value = payload[key]
      if (typeof value === 'string') {
        const iso = parseDateToIso(value)
        if (iso) return iso
      }
    }
  }
  return null
}

const extractIdentifierArray = (
  metadata: Record<string, unknown> | undefined,
  keys: string[],
): string[] => {
  if (!metadata) return []
  const identifiers = new Set<string>()
  const addValue = (raw: unknown) => {
    if (typeof raw === 'string') {
      const normalised = normaliseIdentifier(raw)
      if (normalised) {
        identifiers.add(normalised)
      }
    } else if (Array.isArray(raw)) {
      raw.forEach((entry) => {
        if (typeof entry === 'string') {
          const normalised = normaliseIdentifier(entry)
          if (normalised) {
            identifiers.add(normalised)
          }
        }
      })
    }
  }

  keys.forEach((key) => {
    addValue(metadata[key])
  })

  return Array.from(identifiers)
}

const extractEmailCandidates = (user: User): string[] => {
  const emails = new Set<string>()

  const register = (raw: string | null | undefined) => {
    if (!raw) return
    const parts = raw
      .split(/[,\s;]/)
      .map((part) => part.trim())
      .filter((part) => part.includes('@'))

    parts.forEach((part) => {
      if (!part) return
      emails.add(part)
      emails.add(part.toLowerCase())
    })
  }

  register(user.email ?? null)

  const metadata = user.user_metadata ?? {}
  Object.values(metadata).forEach((value) => {
    if (typeof value === 'string') {
      register(value)
    } else if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === 'string') {
          register(entry)
        }
      })
    }
  })

  return Array.from(emails)
}

const isFlipSchedule = (frequency: string | null, flip: string | null): boolean => {
  if (!frequency) return false
  const normalizedFrequency = frequency.trim().toLowerCase()
  if (!normalizedFrequency) return false
  const normalizedFlip = flip?.trim().toLowerCase()
  return normalizedFrequency === 'fortnightly' && normalizedFlip === 'yes'
}

const describeBinFrequency = (
  label: string,
  frequency: string | null,
  flip: string | null,
) => {
  if (!frequency) return null
  const base = `${label} (${frequency.toLowerCase()})`
  if (isFlipSchedule(frequency, flip)) {
    return `${base}, alternate weeks`
  }
  return base
}

const nextOccurrenceIso = (dayOfWeek: string | null): string => {
  if (!dayOfWeek) {
    return addMinutes(new Date(), 120).toISOString()
  }
  const key = dayOfWeek.trim().replace(/,/g, '').toLowerCase()
  const weekday = WEEKDAY_LOOKUP[key]
  if (weekday === undefined) {
    return addMinutes(new Date(), 120).toISOString()
  }
  const today = startOfToday()
  const scheduled = today.getDay() === weekday ? today : nextDay(today, weekday)
  const withHour = setMinutes(setHours(scheduled, 9), 0)
  return withHour.toISOString()
}

const deriveAccountId = (row: ClientListRow): string =>
  row.account_id && row.account_id.trim().length ? row.account_id.trim() : row.property_id

const deriveAccountName = (row: ClientListRow): string =>
  row.company?.trim() || row.client_name?.trim() || 'My Properties'

const parseAddress = (
  address: string | null | undefined,
): { addressLine: string; suburb: string; city: string } => {
  const parts = (address ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  const [addressLine = '', suburb = '', ...rest] = parts
  const city = rest.join(', ') || suburb

  return { addressLine, suburb, city }
}

const toProperty = (row: ClientListRow): Property => {
  const { addressLine, suburb, city } = parseAddress(row.address)
  const garbageDescription = describeBinFrequency('Garbage', row.red_freq, row.red_flip)
  const recyclingDescription = describeBinFrequency('Recycling', row.yellow_freq, row.yellow_flip)
  const compostDescription = describeBinFrequency('Compost', row.green_freq, row.green_flip)
  const binTypes = [garbageDescription, recyclingDescription, compostDescription].filter(Boolean) as string[]
  const binDescriptions = {
    garbage: garbageDescription,
    recycling: recyclingDescription,
    compost: compostDescription,
  }
  const binFlips = {
    garbage: isFlipSchedule(row.red_freq, row.red_flip),
    recycling: isFlipSchedule(row.yellow_freq, row.yellow_flip),
    compost: isFlipSchedule(row.green_freq, row.green_flip),
  }
  const parseBinCount = (value: number | string | null | undefined): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      const rounded = Math.round(value)
      return rounded > 0 ? rounded : 0
    }
    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed
      }
    }
    return 0
  }
  const garbageCount = parseBinCount(row.red_bins)
  const recyclingCount = parseBinCount(row.yellow_bins)
  const compostCount = parseBinCount(row.green_bins)
  const nextServiceAt = row.collection_day ? nextOccurrenceIso(row.collection_day) : null
  const { lat, lng } = parseLatLng(row.lat_lng)
  const isActive = row.membership_start
    ? new Date(row.membership_start) <= new Date()
    : Boolean(row.trial_start)
  return {
    id: row.property_id,
    name: addressLine || row.client_name || 'Property',
    addressLine,
    suburb,
    city,
    status: isActive ? 'active' : 'paused',
    binTypes,
    binCounts: {
      garbage: garbageCount,
      recycling: recyclingCount,
      compost: compostCount,
      total: garbageCount + recyclingCount + compostCount,
    },
    binDescriptions,
    binFlips,
    nextServiceAt,
    latitude: lat,
    longitude: lng,
    pricePerMonth: row.price_per_month ?? null,
    trialStart: row.trial_start,
    membershipStart: row.membership_start,
    notes: row.notes,
    putOutDay: row.put_bins_out,
    collectionDay: row.collection_day,
  }
}

const mergeNotificationPrefs = (
  accountId: string,
  userId: string,
  metadata: NotificationMetadata | undefined,
): NotificationPreferences => {
  const stored = metadata?.[accountId] ?? {}
  return {
    accountId,
    userId,
    emailRouteUpdates: stored.emailRouteUpdates ?? DEFAULT_NOTIFICATION_PREFS.emailRouteUpdates,
    pushRouteUpdates: stored.pushRouteUpdates ?? DEFAULT_NOTIFICATION_PREFS.pushRouteUpdates,
    emailBilling: stored.emailBilling ?? DEFAULT_NOTIFICATION_PREFS.emailBilling,
    pushBilling: stored.pushBilling ?? DEFAULT_NOTIFICATION_PREFS.pushBilling,
    emailPropertyAlerts: stored.emailPropertyAlerts ?? DEFAULT_NOTIFICATION_PREFS.emailPropertyAlerts,
    pushPropertyAlerts: stored.pushPropertyAlerts ?? DEFAULT_NOTIFICATION_PREFS.pushPropertyAlerts,
  }
}

export function ClientPortalProvider({ children }: { children: React.ReactNode }) {
  const supabase = useSupabase()
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [accounts, setAccounts] = useState<ClientAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [profile, setProfile] = useState<ClientProfile | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [propertiesLoading, setPropertiesLoading] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobHistory, setJobHistory] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences | null>(null)
  const [preferencesLoading, setPreferencesLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const allClientRowsRef = useRef<ClientListRow[]>([])

  const loadProfile = useCallback(async (currentUser: User) => {
    const { data, error: profileError } = await supabase
      .from('user_profile')
      .select('full_name, phone, role, map_style_pref, nav_pref')
      .eq('user_id', currentUser.id)
      .maybeSingle()

    if (profileError) {
      console.warn('Failed to load client profile', profileError)
    }

    setProfile({
      id: currentUser.id,
      fullName: data?.full_name ?? currentUser.user_metadata?.full_name ?? currentUser.email ?? 'Client User',
      phone: data?.phone ?? currentUser.user_metadata?.phone ?? null,
      companyName: currentUser.user_metadata?.company ?? null,
      timezone: currentUser.user_metadata?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
  }, [supabase])

  const fetchClientRows = useCallback(async (currentUser: User): Promise<ClientListRow[]> => {
    const emailCandidates = extractEmailCandidates(currentUser)
    const metadata = currentUser.user_metadata ?? {}
    const accountCandidates = extractIdentifierArray(metadata, [
      'account_id',
      'accountId',
      'account_ids',
      'accountIds',
      'client_account_id',
      'clientAccountId',
      'client_account_ids',
      'clientAccountIds',
    ])
    const propertyCandidates = extractIdentifierArray(metadata, [
      'property_id',
      'propertyId',
      'property_ids',
      'propertyIds',
      'client_property_id',
      'clientPropertyId',
      'client_property_ids',
      'clientPropertyIds',
    ])

    if (emailCandidates.length === 0 && accountCandidates.length === 0 && propertyCandidates.length === 0) {
      return []
    }

    const filters: string[] = []
    const escapeValue = (value: string) => value.replace(/,/g, '\\,').replace(/'/g, "''")

    emailCandidates.forEach((email) => {
      const safe = escapeValue(email)
      filters.push(`email.ilike.%${safe}%`)
      filters.push(`email.eq.${safe}`)
    })
    accountCandidates.forEach((accountId) => {
      const safe = escapeValue(accountId)
      filters.push(`account_id.eq.${safe}`)
    })
    propertyCandidates.forEach((propertyId) => {
      const safe = escapeValue(propertyId)
      filters.push(`property_id.eq.${safe}`)
    })

    let query = supabase
      .from('client_list')
      .select(
        `property_id, account_id, client_name, company, address, collection_day, put_bins_out, notes, red_freq, red_flip, red_bins, yellow_freq, yellow_flip, yellow_bins, green_freq, green_flip, green_bins, email, assigned_to, lat_lng, price_per_month, photo_path, trial_start, membership_start`,
      )

    const uniqueFilters = Array.from(new Set(filters))

    if (uniqueFilters.length > 0) {
      query = query.or(uniqueFilters.join(','))
    }

    const { data, error: rowsError } = await query

    if (rowsError) {
      console.warn('Failed to fetch client properties', rowsError)
      return []
    }

    const deduped = new Map<string, ClientListRow>()

    ;(data ?? []).forEach((row) => {
      const propertyId = normaliseIdentifier(row.property_id)
      if (!propertyId) return
      deduped.set(propertyId, {
        property_id: propertyId,
        account_id: normaliseIdentifier(row.account_id),
        client_name: row.client_name,
        company: row.company,
        address: row.address,
        collection_day: row.collection_day,
        put_bins_out: row.put_bins_out,
        notes: row.notes,
        red_freq: row.red_freq,
        red_flip: row.red_flip,
        red_bins: typeof row.red_bins === 'number' || typeof row.red_bins === 'string' ? row.red_bins : null,
        yellow_freq: row.yellow_freq,
        yellow_flip: row.yellow_flip,
        yellow_bins: typeof row.yellow_bins === 'number' || typeof row.yellow_bins === 'string' ? row.yellow_bins : null,
        green_freq: row.green_freq,
        green_flip: row.green_flip,
        green_bins: typeof row.green_bins === 'number' || typeof row.green_bins === 'string' ? row.green_bins : null,
        email: row.email,
        assigned_to: row.assigned_to,
        lat_lng: row.lat_lng,
        price_per_month: typeof row.price_per_month === 'number' ? row.price_per_month : null,
        photo_path: row.photo_path,
        trial_start: typeof row.trial_start === 'string' ? row.trial_start : null,
        membership_start: typeof row.membership_start === 'string' ? row.membership_start : null,
      })
    })

    return Array.from(deduped.values())
  }, [supabase])

  const deriveAccountsFromRows = useCallback(
    (rows: ClientListRow[], currentUser: User | null): ClientAccount[] => {
      if (rows.length === 0) {
        return [
          {
            id: currentUser?.id ?? 'primary',
            name: currentUser?.user_metadata?.company ?? currentUser?.email ?? 'My Properties',
            role: (currentUser?.user_metadata?.role as ClientAccountRole) ?? 'owner',
            propertyIds: [],
          },
        ]
      }

    const grouped = new Map<string, ClientAccount>()
    rows.forEach((row) => {
      const id = deriveAccountId(row)
      const existing = grouped.get(id)
      if (existing) {
        existing.propertyIds.push(row.property_id)
      } else {
        grouped.set(id, {
          id,
          name: deriveAccountName(row),
          role: (currentUser?.user_metadata?.role as ClientAccountRole) ?? 'owner',
          propertyIds: [row.property_id],
        })
      }
    })
      return Array.from(grouped.values())
    },
    [],
  )

  const refreshProperties = useCallback(async () => {
    if (!selectedAccountId || !user) return
    setPropertiesLoading(true)
    const rows = await fetchClientRows(user)
    allClientRowsRef.current = rows
    const filtered = rows.filter((row) => deriveAccountId(row) === selectedAccountId)
    setProperties(filtered.map(toProperty))
    setPropertiesLoading(false)
  }, [fetchClientRows, selectedAccountId, user])

  const refreshJobs = useCallback(async () => {
    if (!selectedAccountId || !user) return
    setJobsLoading(true)
    const accountId = selectedAccountId
    const allRows = allClientRowsRef.current
    const propertiesForAccount = allRows.filter((row) => deriveAccountId(row) === accountId)
    const propertyMap = new Map<string, Property>()
    propertiesForAccount.forEach((row) => {
      propertyMap.set(row.property_id, toProperty(row))
    })
    const addressLookup = new Map<string, string>()
    propertiesForAccount.forEach((row) => {
      addressLookup.set(normaliseAddress(row.address), row.property_id)
    })

    const propertyIds = propertiesForAccount
      .map((row) => normaliseIdentifier(row.property_id))
      .filter((value): value is string => Boolean(value))

    const accountCandidates = new Set<string>()
    const addCandidate = (value: string | null | undefined) => {
      const normalised = normaliseIdentifier(value)
      if (normalised) {
        accountCandidates.add(normalised)
      }
    }

    addCandidate(accountId)
    propertiesForAccount.forEach((row) => {
      addCandidate(row.account_id)
      addCandidate(row.property_id)
    })

    const accountIdFilters = Array.from(accountCandidates)
    const jobSelectFields =
      'id, account_id, property_id, lat, lng, last_completed_on, day_of_week, address, photo_path, client_name, bins, notes, job_type'

    const mergedJobRows: any[] = []

    if (accountIdFilters.length > 0) {
      const { data, error } = await supabase
        .from('jobs')
        .select(jobSelectFields)
        .in('account_id', accountIdFilters)

      if (error) {
        console.warn('Failed to load jobs', error)
      }

      if (data) {
        mergedJobRows.push(...data)
      }
    } else if (accountId) {
      const { data, error } = await supabase
        .from('jobs')
        .select(jobSelectFields)
        .eq('account_id', accountId)

      if (error) {
        console.warn('Failed to load jobs', error)
      }

      if (data) {
        mergedJobRows.push(...data)
      }
    }

    if (propertyIds.length > 0) {
      const { data, error } = await supabase
        .from('jobs')
        .select(jobSelectFields)
        .in('property_id', propertyIds)

      if (error) {
        console.warn('Failed to load jobs', error)
      }

      if (data) {
        mergedJobRows.push(...data)
      }
    }
    const seenJobIds = new Set<string>()
    const jobRows = mergedJobRows.filter((row) => {
      const id = row?.id
      if (!id) return false
      const key = String(id)
      if (seenJobIds.has(key)) return false
      seenJobIds.add(key)
      return true
    })

    const twoMonthsAgo = subMonths(new Date(), 2)

    let logsQuery = supabase
      .from('logs')
      .select(
        'id, job_id, account_id, client_name, address, task_type, bins, notes, photo_path, done_on, gps_lat, gps_lng, created_at',
      )
      .gte('done_on', formatISO(twoMonthsAgo, { representation: 'date' }))

    if (accountIdFilters.length === 1) {
      logsQuery = logsQuery.eq('account_id', accountIdFilters[0]!)
    } else if (accountIdFilters.length > 1) {
      logsQuery = logsQuery.in('account_id', accountIdFilters)
    } else {
      logsQuery = logsQuery.eq('account_id', accountId)
    }

    const { data: logRows, error: logsError } = await logsQuery

    if (logsError) {
      console.warn('Failed to load logs', logsError)
    }

    type LogRow = NonNullable<typeof logRows>[number]

    const logsByJobId = new Map<string, LogRow>()
    ;(logRows ?? []).forEach((log) => {
      if (log.job_id) {
        const existing = logsByJobId.get(log.job_id)
        if (!existing || (log.done_on && log.done_on > (existing.done_on ?? ''))) {
          logsByJobId.set(log.job_id, log)
        }
      }
    })

    type ProgressRow = {
      job_id?: string | number | null
      account_id?: string | number | null
    } & Record<string, unknown>

    let progressRows: ProgressRow[] | null = null
    let progressQueryError: unknown = null

    try {
      let progressQuery = supabase
        .from('job_progress_events')
        .select('*')
        .gte('created_at', twoMonthsAgo.toISOString())

      if (accountIdFilters.length === 1) {
        progressQuery = progressQuery.eq('account_id', accountIdFilters[0]!)
      } else if (accountIdFilters.length > 1) {
        progressQuery = progressQuery.in('account_id', accountIdFilters)
      } else if (accountId) {
        progressQuery = progressQuery.eq('account_id', accountId)
      }

      const { data, error } = await progressQuery
      if (error) {
        progressQueryError = error
      } else {
        progressRows = data as ProgressRow[] | null
      }
    } catch (error) {
      progressQueryError = error
    }

    if (progressQueryError) {
      console.warn('Failed to load job progress events', progressQueryError)
    }

    type ProgressSnapshot = {
      status: JobStatus
      startedAt: string | null
      arrivedAt: string | null
      completedAt: string | null
      statusUpdatedAt: string | null
    }

    const progressByJobId = new Map<string, ProgressSnapshot>()

    const ensureSnapshot = (jobId: string): ProgressSnapshot => {
      const existing = progressByJobId.get(jobId)
      if (existing) return existing
      const snapshot: ProgressSnapshot = {
        status: 'scheduled',
        startedAt: null,
        arrivedAt: null,
        completedAt: null,
        statusUpdatedAt: null,
      }
      progressByJobId.set(jobId, snapshot)
      return snapshot
    }

    const sortedProgressRows = [...(progressRows ?? [])].sort((a, b) => {
      const firstIso = extractProgressTimestamp(a)
      const secondIso = extractProgressTimestamp(b)
      const firstTime = firstIso ? new Date(firstIso).getTime() : 0
      const secondTime = secondIso ? new Date(secondIso).getTime() : 0
      return firstTime - secondTime
    })

    sortedProgressRows.forEach((row) => {
      const jobIdKey = normaliseIdentifier(row.job_id)
      if (!jobIdKey) {
        return
      }

      const status = extractStatusFromPayload(row)
      if (!status) {
        return
      }

      const occurredAtIso = extractProgressTimestamp(row)
      const snapshot = ensureSnapshot(jobIdKey)
      if (status === 'en_route' && occurredAtIso) {
        snapshot.startedAt = occurredAtIso
      }
      if (status === 'on_site' && occurredAtIso) {
        snapshot.arrivedAt = occurredAtIso
      }
      if ((status === 'completed' || status === 'skipped') && occurredAtIso) {
        snapshot.completedAt = occurredAtIso
      }

      const currentRank = JOB_STATUS_PRIORITY[snapshot.status]
      const nextRank = JOB_STATUS_PRIORITY[status]
      const shouldPromote =
        nextRank > currentRank ||
        (nextRank === currentRank &&
          occurredAtIso &&
          (!snapshot.statusUpdatedAt || occurredAtIso > snapshot.statusUpdatedAt))

      if (shouldPromote) {
        snapshot.status = status
        snapshot.statusUpdatedAt = occurredAtIso ?? snapshot.statusUpdatedAt ?? null
      } else if (occurredAtIso && (!snapshot.statusUpdatedAt || occurredAtIso > snapshot.statusUpdatedAt)) {
        snapshot.statusUpdatedAt = occurredAtIso
      }
    })

    const combinedJobs: Job[] = []
    const historyJobs: Job[] = []

    ;(logRows ?? []).forEach((log) => {
      const jobIdKey = normaliseIdentifier(log.job_id)
      const logAccountId = normaliseIdentifier(log.account_id)

      if (jobIdKey && (!logAccountId || logAccountId === accountId)) {
        const existing = logsByJobId.get(jobIdKey)
        if (!existing || (log.done_on && log.done_on > (existing.done_on ?? ''))) {
          logsByJobId.set(jobIdKey, log)
        }
      }

      const propertyId = addressLookup.get(normaliseAddress(log.address)) ?? null
      const property = propertyId ? propertyMap.get(propertyId) : undefined
      const propertyName = property?.name ?? log.client_name ?? log.address ?? 'Property'

      if (!property && logAccountId && logAccountId !== accountId) {
        return
      }

      const completedAtIso = parseDateToIso(log.done_on ?? log.created_at)
      const uploadedAtIso = parseDateToIso(log.created_at)
      const progress = jobIdKey ? progressByJobId.get(jobIdKey) : undefined

      if (jobIdKey && completedAtIso) {
        const snapshot = ensureSnapshot(jobIdKey)
        if (!snapshot.completedAt || completedAtIso > snapshot.completedAt) {
          snapshot.completedAt = completedAtIso
        }
        const currentRank = JOB_STATUS_PRIORITY[snapshot.status]
        const completedRank = JOB_STATUS_PRIORITY['completed']
        if (completedRank >= currentRank) {
          snapshot.status = 'completed'
          snapshot.statusUpdatedAt = completedAtIso
        } else if (!snapshot.statusUpdatedAt || completedAtIso > snapshot.statusUpdatedAt) {
          snapshot.statusUpdatedAt = completedAtIso
        }
      }

      if (!completedAtIso) {
        return
      }

      const logJob: Job = {
        id: jobIdKey ? `${jobIdKey}-${log.id}` : `log-${log.id}`,
        accountId,
        propertyId,
        propertyName,
        status: 'completed',
        scheduledAt: completedAtIso,
        etaMinutes: null,
        startedAt: progress?.startedAt ?? null,
        arrivedAt: progress?.arrivedAt ?? null,
        completedAt: completedAtIso,
        crewName: null,
        proofPhotoKeys: log.photo_path ? [log.photo_path] : [],
        proofUploadedAt: uploadedAtIso,
        routePolyline: null,
        lastLatitude: log.gps_lat ?? undefined,
        lastLongitude: log.gps_lng ?? undefined,
        notes: log.notes,
        jobType: log.task_type,
        bins: normaliseBinList(log.bins),
        statusUpdatedAt: progress?.statusUpdatedAt ?? completedAtIso,
      }

      historyJobs.push(logJob)

      if (!jobIdKey) {
        combinedJobs.push(logJob)
      }
    })

    ;(jobRows ?? []).forEach((job) => {
      const explicitPropertyId =
        typeof job.property_id === 'string' && job.property_id.trim().length ? job.property_id.trim() : null
      const propertyId = explicitPropertyId ?? addressLookup.get(normaliseAddress(job.address)) ?? null
      const property = propertyId ? propertyMap.get(propertyId) : undefined
      const propertyName = property?.name ?? job.address ?? 'Property'
      const scheduledAt = nextOccurrenceIso(job.day_of_week)
      const jobIdKey = normaliseIdentifier(job.id)
      const latestLog = jobIdKey ? logsByJobId.get(jobIdKey) : undefined
      const jobAccountId = normaliseIdentifier(job.account_id)
      if (!property && jobAccountId && jobAccountId !== accountId) {
        return
      }
      const progress = jobIdKey ? progressByJobId.get(jobIdKey) : undefined
      const completedAtIsoFromLog = parseDateToIso(latestLog?.done_on ?? job.last_completed_on)
      const progressCompletedAt = progress?.completedAt ?? null
      const completedAtIso = progressCompletedAt ?? completedAtIsoFromLog
      const proofUploadedAtIso = latestLog ? parseDateToIso(latestLog.created_at) : null
      const statusFromProgress = progress?.status
      const status: JobStatus = statusFromProgress
        ? statusFromProgress
        : completedAtIso
          ? 'completed'
          : latestLog
            ? 'en_route'
            : 'scheduled'
      const startedAt = progress?.startedAt ?? null
      const arrivedAt = progress?.arrivedAt ?? null
      const statusUpdatedAt = progress?.statusUpdatedAt ?? completedAtIso ?? proofUploadedAtIso ?? null
      const proofPhotoKeys = [job.photo_path, latestLog?.photo_path].filter(Boolean) as string[]
      const bins = normaliseBinList(job.bins)
      combinedJobs.push({
        id: job.id,
        accountId,
        propertyId,
        propertyName,
        status,
        scheduledAt,
        etaMinutes: status === 'scheduled' ? Math.max(5, differenceInMinutes(new Date(scheduledAt), new Date())) : null,
        startedAt,
        arrivedAt,
        completedAt: completedAtIso,
        crewName: null,
        proofPhotoKeys,
        proofUploadedAt: proofUploadedAtIso,
        routePolyline: null,
        lastLatitude: job.lat ?? undefined,
        lastLongitude: job.lng ?? undefined,
        notes: job.notes ?? latestLog?.notes ?? null,
        jobType: job.job_type,
        bins,
        statusUpdatedAt,
      })
    })

    combinedJobs.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
    historyJobs.sort((a, b) => {
      const first = a.completedAt ?? a.scheduledAt
      const second = b.completedAt ?? b.scheduledAt
      const firstTime = first ? new Date(first).getTime() : 0
      const secondTime = second ? new Date(second).getTime() : 0
      return secondTime - firstTime
    })

    setJobs(combinedJobs)
    setJobHistory(historyJobs)
    setJobsLoading(false)
  }, [selectedAccountId, supabase, user])

  const isCompleteJob = (job: Partial<Job>): job is Job => {
    return Boolean(job.id && job.accountId && job.propertyName && job.status && job.scheduledAt)
  }

  const upsertJob = useCallback((job: Partial<Job> & { id: string }) => {
    setJobs((previousJobs) => {
      const index = previousJobs.findIndex((existing) => existing.id === job.id)

      if (index >= 0) {
        const updatedJobs = [...previousJobs]
        updatedJobs[index] = { ...updatedJobs[index], ...job }
        return updatedJobs.sort(
          (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
        )
      }

      if (isCompleteJob(job)) {
        const updatedJobs: Job[] = [job, ...previousJobs]
        return updatedJobs.sort(
          (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
        )
      }

      return previousJobs
    })
  }, [])

  const loadPreferences = useCallback(
    async (currentUser: User, accountId: string) => {
      setPreferencesLoading(true)
      const metadata = currentUser.user_metadata?.notification_preferences as NotificationMetadata | undefined
      setNotificationPreferences(mergeNotificationPrefs(accountId, currentUser.id, metadata))
      setPreferencesLoading(false)
    },
    [],
  )

  const refreshNotificationPreferences = useCallback(async () => {
    if (!user || !selectedAccountId) return
    setPreferencesLoading(true)
    const { data } = await supabase.auth.getUser()
    if (data.user) {
      setUser(data.user)
      setNotificationPreferences(
        mergeNotificationPrefs(
          selectedAccountId,
          data.user.id,
          (data.user.user_metadata?.notification_preferences as NotificationMetadata | undefined) ?? {},
        ),
      )
    }
    setPreferencesLoading(false)
  }, [selectedAccountId, supabase, user])

  useEffect(() => {
    let mounted = true

    const initialise = async () => {
      const {
        data: { session: initialSession },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        setError(sessionError.message)
        setLoading(false)
        return
      }

      if (!initialSession?.user) {
        router.replace('/auth/login')
        return
      }

      if (!mounted) return

      const currentUser = initialSession.user
      setSession(initialSession)
      setUser(currentUser)

      const rows = await fetchClientRows(currentUser)
      allClientRowsRef.current = rows
      const derivedAccounts = deriveAccountsFromRows(rows, currentUser)
      setAccounts(derivedAccounts)
      const storedAccountId = typeof window !== 'undefined' ? localStorage.getItem('binbird-selected-account-id') : null
      const firstAccountId =
        derivedAccounts.find((account) => account.id === storedAccountId)?.id ?? derivedAccounts[0]?.id ?? null
      setSelectedAccountId(firstAccountId)

      await Promise.all([
        loadProfile(currentUser),
        loadPreferences(currentUser, firstAccountId ?? derivedAccounts[0]?.id ?? 'primary'),
      ])

      if (firstAccountId) {
        const filteredRows = rows.filter((row) => deriveAccountId(row) === firstAccountId)
        setProperties(filteredRows.map(toProperty))
      }

      setLoading(false)
    }

    initialise()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      if (!newSession) {
        router.replace('/auth/login')
      }
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [deriveAccountsFromRows, fetchClientRows, loadPreferences, loadProfile, router, supabase])

  useEffect(() => {
    if (!selectedAccountId || !user) return
    localStorage.setItem('binbird-selected-account-id', selectedAccountId)
    const load = async () => {
      await refreshProperties()
      await refreshJobs()
      await loadPreferences(user, selectedAccountId)
    }
    void load()
  }, [loadPreferences, refreshJobs, refreshProperties, selectedAccountId, user])

  const selectAccount = useCallback((accountId: string) => {
    setSelectedAccountId(accountId)
  }, [])

  const value: ClientPortalContextValue = useMemo(
    () => ({
      session,
      user,
      profile,
      accounts,
      selectedAccount: accounts.find((account) => account.id === selectedAccountId) ?? null,
      selectAccount,
      properties,
      propertiesLoading,
      refreshProperties,
      jobHistory,
      jobs,
      jobsLoading,
      refreshJobs,
      upsertJob,
      notificationPreferences,
      preferencesLoading,
      refreshNotificationPreferences,
      loading,
      error,
    }),
    [
      accounts,
      profile,
      error,
      jobHistory,
      jobs,
      jobsLoading,
      loading,
      notificationPreferences,
      preferencesLoading,
      properties,
      propertiesLoading,
      refreshJobs,
      refreshProperties,
      refreshNotificationPreferences,
      selectAccount,
      selectedAccountId,
      session,
      upsertJob,
      user,
    ],
  )

  return <ClientPortalContext.Provider value={value}>{children}</ClientPortalContext.Provider>
}

export function useClientPortal() {
  const context = useContext(ClientPortalContext)
  if (!context) {
    throw new Error('useClientPortal must be used within a ClientPortalProvider')
  }
  return context
}

export const computeEtaLabel = (job: Job): string => {
  if (job.status === 'completed') {
    return 'Completed'
  }

  if (job.status === 'skipped') {
    return 'Skipped'
  }

  const now = new Date()
  const scheduledAt = job.scheduledAt ? new Date(job.scheduledAt) : now
  const etaFromField = job.etaMinutes ?? undefined

  if (job.startedAt) {
    const startedAtDate = new Date(job.startedAt)
    const minutesSinceStart = Math.max(0, differenceInMinutes(now, startedAtDate))
    const etaMinutes = Math.max(0, (etaFromField ?? 20) - minutesSinceStart)
    if (etaMinutes <= 1) return 'Arriving now'
    return `~${etaMinutes} min`
  }

  if (etaFromField !== undefined && etaFromField !== null) {
    if (etaFromField <= 1) return 'Arriving now'
    return `~${etaFromField} min`
  }

  if (scheduledAt > now) {
    const etaMinutes = Math.max(5, differenceInMinutes(scheduledAt, now))
    if (etaMinutes > 120) {
      return `${Math.round(etaMinutes / 60)}h out`
    }
    return `~${etaMinutes} min`
  }

  if (job.status === 'on_site' || job.status === 'en_route') {
    return 'In progress'
  }

  const fallbackEta = addMinutes(now, 20)
  return `~${differenceInMinutes(fallbackEta, now)} min`
}
