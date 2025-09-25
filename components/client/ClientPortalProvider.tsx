'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
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
  completedAt?: string | null
  crewName?: string | null
  proofPhotoKeys?: string[] | null
  routePolyline?: string | null
  lastLatitude?: number | null
  lastLongitude?: number | null
  notes?: string | null
  jobType?: string | null
  bins?: string[]
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
  id: string
  client_name: string | null
  company: string | null
  address: string | null
  collection_day: string | null
  put_bins_out: string | null
  notes: string | null
  red_freq: string | null
  red_flip: string | null
  yellow_freq: string | null
  yellow_flip: string | null
  green_freq: string | null
  green_flip: string | null
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
  jobs: Job[]
  jobsLoading: boolean
  refreshJobs: () => Promise<void>
  upsertJob: (job: Job) => void
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

const WEEKDAY_LOOKUP: Record<string, number> = {
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

const describeBinFrequency = (color: string, frequency: string | null, flip: string | null) => {
  if (!frequency) return null
  const base = `${color} (${frequency.toLowerCase()})`
  if (frequency === 'Fortnightly' && flip === 'Yes') {
    return `${base}, alternate weeks`
  }
  return base
}

const nextOccurrenceIso = (dayOfWeek: string | null): string => {
  if (!dayOfWeek) {
    return addMinutes(new Date(), 120).toISOString()
  }
  const key = dayOfWeek.trim().toLowerCase()
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
  row.client_name?.trim() || row.company?.trim() || row.id

const deriveAccountName = (row: ClientListRow): string =>
  row.company?.trim() || row.client_name?.trim() || 'My Properties'

const toProperty = (row: ClientListRow): Property => {
  const [addressLine, suburbRaw = ''] = (row.address ?? '').split(',')
  const suburb = suburbRaw.trim()
  const binTypes = [
    describeBinFrequency('Red', row.red_freq, row.red_flip),
    describeBinFrequency('Yellow', row.yellow_freq, row.yellow_flip),
    describeBinFrequency('Green', row.green_freq, row.green_flip),
  ].filter(Boolean) as string[]
  const nextServiceAt = row.collection_day ? nextOccurrenceIso(row.collection_day) : null
  const { lat, lng } = parseLatLng(row.lat_lng)
  const isActive = row.membership_start
    ? new Date(row.membership_start) <= new Date()
    : Boolean(row.trial_start)
  return {
    id: row.id,
    name: row.client_name ?? addressLine ?? 'Property',
    addressLine: (addressLine ?? '').trim(),
    suburb,
    city: suburb,
    status: isActive ? 'active' : 'paused',
    binTypes,
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
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [accounts, setAccounts] = useState<ClientAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [profile, setProfile] = useState<ClientProfile | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [propertiesLoading, setPropertiesLoading] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences | null>(null)
  const [preferencesLoading, setPreferencesLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [allClientRows, setAllClientRows] = useState<ClientListRow[]>([])

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
  }, [])

  const fetchClientRows = useCallback(async (currentUser: User): Promise<ClientListRow[]> => {
    const email = currentUser.email ?? ''
    if (!email) return []
    const emailLower = email.toLowerCase()
    const { data, error: rowsError } = await supabase
      .from('client_list')
      .select(
        `id, client_name, company, address, collection_day, put_bins_out, notes, red_freq, red_flip, yellow_freq, yellow_flip, green_freq, green_flip, email, assigned_to, lat_lng, price_per_month, photo_path, trial_start, membership_start`,
      )
      .or(`email.eq.${email},email.eq.${emailLower}`)

    if (rowsError) {
      console.warn('Failed to fetch client properties', rowsError)
      return []
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      client_name: row.client_name,
      company: row.company,
      address: row.address,
      collection_day: row.collection_day,
      put_bins_out: row.put_bins_out,
      notes: row.notes,
      red_freq: row.red_freq,
      red_flip: row.red_flip,
      yellow_freq: row.yellow_freq,
      yellow_flip: row.yellow_flip,
      green_freq: row.green_freq,
      green_flip: row.green_flip,
      email: row.email,
      assigned_to: row.assigned_to,
      lat_lng: row.lat_lng,
      price_per_month: row.price_per_month as number | null,
      photo_path: row.photo_path,
      trial_start: row.trial_start as string | null,
      membership_start: row.membership_start as string | null,
    }))
  }, [])

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
          existing.propertyIds.push(row.id)
        } else {
          grouped.set(id, {
            id,
            name: deriveAccountName(row),
            role: (currentUser?.user_metadata?.role as ClientAccountRole) ?? 'owner',
            propertyIds: [row.id],
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
    setAllClientRows(rows)
    const filtered = rows.filter((row) => deriveAccountId(row) === selectedAccountId)
    setProperties(filtered.map(toProperty))
    setPropertiesLoading(false)
  }, [fetchClientRows, selectedAccountId, user])

  const refreshJobs = useCallback(async () => {
    if (!selectedAccountId || !user) return
    setJobsLoading(true)
    const accountId = selectedAccountId
    const propertiesForAccount = allClientRows.filter((row) => deriveAccountId(row) === accountId)
    const propertyMap = new Map<string, Property>()
    propertiesForAccount.forEach((row) => {
      propertyMap.set(row.id, toProperty(row))
    })
    const addressLookup = new Map<string, string>()
    propertiesForAccount.forEach((row) => {
      addressLookup.set(normaliseAddress(row.address), row.id)
    })

    const twoMonthsAgo = subMonths(new Date(), 2)

    const { data: jobRows, error: jobsError } = await supabase
      .from('jobs')
      .select('id, lat, lng, last_completed_on, day_of_week, address, photo_path, client_name, bins, notes, job_type')
      .eq('client_name', accountId)

    if (jobsError) {
      console.warn('Failed to load jobs', jobsError)
    }

    const { data: logRows, error: logsError } = await supabase
      .from('logs')
      .select('id, job_id, client_name, address, task_type, bins, notes, photo_path, done_on, gps_lat, gps_lng, created_at')
      .eq('client_name', accountId)
      .gte('done_on', formatISO(twoMonthsAgo, { representation: 'date' }))

    if (logsError) {
      console.warn('Failed to load logs', logsError)
    }

    const logsByJobId = new Map<string, (typeof logRows)[number]>()
    ;(logRows ?? []).forEach((log) => {
      if (log.job_id) {
        const existing = logsByJobId.get(log.job_id)
        if (!existing || (log.done_on && log.done_on > (existing.done_on ?? ''))) {
          logsByJobId.set(log.job_id, log)
        }
      }
    })

    const combinedJobs: Job[] = []

    ;(jobRows ?? []).forEach((job) => {
      const propertyId = addressLookup.get(normaliseAddress(job.address)) ?? null
      const propertyName = propertyId ? propertyMap.get(propertyId)?.name ?? job.address ?? 'Property' : job.address ?? 'Property'
      const scheduledAt = nextOccurrenceIso(job.day_of_week)
      const latestLog = job.id ? logsByJobId.get(job.id) : undefined
      const status: JobStatus = latestLog
        ? 'completed'
        : (() => {
            const scheduledDate = new Date(scheduledAt)
            const now = new Date()
            if (scheduledDate.getTime() < now.getTime() - 60 * 60 * 1000) return 'on_site'
            if (scheduledDate.getTime() <= now.getTime()) return 'en_route'
            return 'scheduled'
          })()
      const proofPhotoKeys = [job.photo_path, latestLog?.photo_path].filter(Boolean) as string[]
      const bins = job.bins ? job.bins.split(',').map((value) => value.trim()) : []
      combinedJobs.push({
        id: job.id,
        accountId,
        propertyId,
        propertyName,
        status,
        scheduledAt,
        etaMinutes: status === 'scheduled' ? Math.max(5, differenceInMinutes(new Date(scheduledAt), new Date())) : null,
        startedAt: null,
        completedAt: latestLog?.done_on ?? (job.last_completed_on ? new Date(job.last_completed_on).toISOString() : null),
        crewName: null,
        proofPhotoKeys,
        routePolyline: null,
        lastLatitude: job.lat ?? undefined,
        lastLongitude: job.lng ?? undefined,
        notes: job.notes ?? latestLog?.notes ?? null,
        jobType: job.job_type,
        bins,
      })
    })

    ;(logRows ?? [])
      .filter((log) => !log.job_id)
      .forEach((log) => {
        const propertyId = addressLookup.get(normaliseAddress(log.address)) ?? null
        const propertyName = propertyId ? propertyMap.get(propertyId)?.name ?? log.address ?? 'Property' : log.address ?? 'Property'
        combinedJobs.push({
          id: `log-${log.id}`,
          accountId,
          propertyId,
          propertyName,
          status: 'completed',
          scheduledAt: log.done_on ?? new Date().toISOString(),
          etaMinutes: null,
          startedAt: null,
          completedAt: log.done_on ?? log.created_at ?? null,
          crewName: null,
          proofPhotoKeys: log.photo_path ? [log.photo_path] : [],
          routePolyline: null,
          lastLatitude: log.gps_lat ?? undefined,
          lastLongitude: log.gps_lng ?? undefined,
          notes: log.notes,
          jobType: log.task_type,
          bins: log.bins ? log.bins.split(',').map((value) => value.trim()) : [],
        })
      })

    combinedJobs.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
    setJobs(combinedJobs)
    setJobsLoading(false)
  }, [allClientRows, selectedAccountId, user])

  const upsertJob = useCallback((job: Job) => {
    setJobs((previousJobs) => {
      const nextJobs = [...previousJobs]
      const index = nextJobs.findIndex((existing) => existing.id === job.id)
      if (index >= 0) {
        nextJobs[index] = { ...nextJobs[index], ...job }
      } else {
        nextJobs.unshift(job)
      }
      return nextJobs.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
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
        router.replace('/client/login')
        return
      }

      if (!mounted) return

      const currentUser = initialSession.user
      setSession(initialSession)
      setUser(currentUser)

      const rows = await fetchClientRows(currentUser)
      setAllClientRows(rows)
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
        router.replace('/client/login')
      }
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [deriveAccountsFromRows, fetchClientRows, loadPreferences, loadProfile, router])

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
      jobs,
      jobsLoading,
      refreshJobs,
      upsertJob,
      notificationPreferences,
      preferencesLoading,
      refreshNotificationPreferences: async () => {
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
      },
      loading,
      error,
    }),
    [
      accounts,
      profile,
      error,
      jobs,
      jobsLoading,
      loading,
      notificationPreferences,
      preferencesLoading,
      properties,
      propertiesLoading,
      refreshJobs,
      refreshProperties,
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
