'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import { addMinutes, differenceInMinutes, formatISO, subMonths } from 'date-fns'

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
  latitude?: number | null
  longitude?: number | null
}

export type JobStatus = 'scheduled' | 'en_route' | 'on_site' | 'completed' | 'skipped'

export type Job = {
  id: string
  accountId: string
  propertyId: string
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

const toClientAccount = (raw: any): ClientAccount => ({
  id: String(raw?.id ?? raw?.account_id ?? 'primary'),
  name: raw?.name ?? raw?.account_name ?? 'Primary Property Group',
  role: (raw?.role as ClientAccountRole) ?? 'owner',
  propertyIds: Array.isArray(raw?.property_ids) ? raw.property_ids.map(String) : [],
})

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


  const loadProfile = useCallback(async (currentUser: User) => {
    const { data, error: profileError } = await supabase
      .from('client_profiles')
      .select('id, full_name, phone, company_name, timezone')
      .eq('user_id', currentUser.id)
      .maybeSingle()

    if (profileError) {
      console.warn('Failed to load client profile', profileError)
      setProfile({
        id: currentUser.id,
        fullName: currentUser.user_metadata?.full_name ?? currentUser.email ?? 'Client User',
        phone: currentUser.user_metadata?.phone ?? null,
        companyName: currentUser.user_metadata?.company ?? null,
        timezone: currentUser.user_metadata?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      return
    }

    if (data) {
      setProfile({
        id: data.id ?? currentUser.id,
        fullName: data.full_name ?? currentUser.email ?? 'Client User',
        phone: data.phone,
        companyName: data.company_name,
        timezone: data.timezone,
      })
    }
  }, [])

  const fetchAccounts = useCallback(async (currentUser: User): Promise<ClientAccount[]> => {
    const accountsFromMetadata: ClientAccount[] = Array.isArray(currentUser.user_metadata?.client_accounts)
      ? (currentUser.user_metadata.client_accounts as any[]).map(toClientAccount)
      : []

    try {
      const { data, error: accountError } = await supabase
        .from('client_account_members')
        .select('role, account:client_accounts(id, name, property_ids)')
        .eq('user_id', currentUser.id)

      if (accountError) {
        if (accountsFromMetadata.length === 0) throw accountError
        return accountsFromMetadata
      }

      if (!data || data.length === 0) {
        if (accountsFromMetadata.length > 0) return accountsFromMetadata
        return [
          {
            id: currentUser.id,
            name: 'Primary Property Group',
            role: 'owner',
            propertyIds: [],
          },
        ]
      }

      const typedData = Array.isArray(data) ? data : []
      return typedData.map((entry: any) => {
        const account = entry.account as { id?: string; name?: string; property_ids?: unknown } | null | undefined
        const rawPropertyIds = (account as { property_ids?: unknown } | null | undefined)?.property_ids
        const propertyIds = Array.isArray(rawPropertyIds) ? rawPropertyIds : []
        return {
          id: account?.id ?? currentUser.id,
          name: account?.name ?? 'Property Group',
          role: entry.role ?? 'viewer',
          propertyIds: propertyIds.map(String),
        }
      })
    } catch (unknownError) {
      console.warn('Falling back to metadata accounts', unknownError)
      if (accountsFromMetadata.length > 0) return accountsFromMetadata
      return [
        {
          id: currentUser.id,
          name: 'Primary Property Group',
          role: 'owner',
          propertyIds: [],
        },
      ]
    }
  }, [])

  const refreshProperties = useCallback(async () => {
    if (!selectedAccountId) return
    setPropertiesLoading(true)

    const { data, error: propertiesError } = await supabase
      .from('properties')
      .select('id, name, address_line, suburb, city, status, bin_types, next_service_at, latitude, longitude')
      .eq('account_id', selectedAccountId)
      .order('name', { ascending: true })

    if (propertiesError) {
      console.warn('Failed to load properties', propertiesError)
      setProperties([])
      setPropertiesLoading(false)
      return
    }

    setProperties(
      (data ?? []).map((property) => ({
        id: String(property.id),
        name: property.name ?? 'Untitled Property',
        addressLine: property.address_line ?? '',
        suburb: property.suburb ?? '',
        city: property.city ?? '',
        status: (property.status as Property['status']) ?? 'active',
        binTypes: Array.isArray(property.bin_types) ? property.bin_types : [],
        nextServiceAt: property.next_service_at ?? null,
        latitude: property.latitude,
        longitude: property.longitude,
      })),
    )

    setPropertiesLoading(false)
  }, [selectedAccountId])

  const refreshJobs = useCallback(async () => {
    if (!selectedAccountId) return
    setJobsLoading(true)

    const twoMonthsAgo = subMonths(new Date(), 2)
    const { data, error: jobsError } = await supabase
      .from('jobs')
      .select(
        'id, account_id, property_id, status, scheduled_at, eta_minutes, started_at, completed_at, crew_name, proof_photo_keys, route_polyline, last_latitude, last_longitude, notes, property:properties(name)'
      )
      .eq('account_id', selectedAccountId)
      .gte('scheduled_at', formatISO(twoMonthsAgo))
      .order('scheduled_at', { ascending: false })

    if (jobsError) {
      console.warn('Failed to load jobs', jobsError)
      setJobs([])
      setJobsLoading(false)
      return
    }

    const typedJobs = Array.isArray(data) ? data : []
    setJobs(
      typedJobs.map((job: any) => {
        const propertyRelation = Array.isArray(job.property) ? job.property[0] : job.property
        return {
          id: String(job.id),
          accountId: String(job.account_id ?? selectedAccountId),
          propertyId: String(job.property_id),
          propertyName: propertyRelation?.name ?? 'Unknown property',
          status: (job.status as JobStatus) ?? 'scheduled',
          scheduledAt: job.scheduled_at,
          etaMinutes: job.eta_minutes,
          startedAt: job.started_at,
          completedAt: job.completed_at,
          crewName: job.crew_name,
          proofPhotoKeys: job.proof_photo_keys ?? [],
          routePolyline: job.route_polyline,
          lastLatitude: job.last_latitude,
          lastLongitude: job.last_longitude,
          notes: job.notes,
        }
      }),
    )

    setJobsLoading(false)
  }, [selectedAccountId])

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
      const { data, error: preferencesError } = await supabase
        .from('notification_preferences')
        .select(
          'account_id, user_id, email_route_updates, push_route_updates, email_billing, push_billing, email_property_alerts, push_property_alerts'
        )
        .eq('user_id', currentUser.id)
        .eq('account_id', accountId)
        .maybeSingle()

      if (preferencesError) {
        console.warn('Failed to load notification preferences', preferencesError)
        setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFS, accountId, userId: currentUser.id })
        setPreferencesLoading(false)
        return
      }

      if (data) {
        setNotificationPreferences({
          accountId: data.account_id,
          userId: data.user_id,
          emailRouteUpdates: data.email_route_updates ?? DEFAULT_NOTIFICATION_PREFS.emailRouteUpdates,
          pushRouteUpdates: data.push_route_updates ?? DEFAULT_NOTIFICATION_PREFS.pushRouteUpdates,
          emailBilling: data.email_billing ?? DEFAULT_NOTIFICATION_PREFS.emailBilling,
          pushBilling: data.push_billing ?? DEFAULT_NOTIFICATION_PREFS.pushBilling,
          emailPropertyAlerts: data.email_property_alerts ?? DEFAULT_NOTIFICATION_PREFS.emailPropertyAlerts,
          pushPropertyAlerts: data.push_property_alerts ?? DEFAULT_NOTIFICATION_PREFS.pushPropertyAlerts,
        })
      } else {
        setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFS, accountId, userId: currentUser.id })
      }
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

      setSession(initialSession)
      setUser(initialSession.user)

      const derivedAccounts = await fetchAccounts(initialSession.user)
      setAccounts(derivedAccounts)
      const storedAccountId = localStorage.getItem('binbird-selected-account-id')
      const firstAccountId = derivedAccounts.find((account) => account.id === storedAccountId)?.id ?? derivedAccounts[0]?.id ?? null
      setSelectedAccountId(firstAccountId)

      await Promise.all([loadProfile(initialSession.user), loadPreferences(initialSession.user, firstAccountId ?? derivedAccounts[0]?.id ?? 'primary')])

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
  }, [router, fetchAccounts, loadPreferences, loadProfile])

  useEffect(() => {
    if (!selectedAccountId || !user) return
    localStorage.setItem('binbird-selected-account-id', selectedAccountId)
    refreshProperties()
    refreshJobs()
    loadPreferences(user, selectedAccountId)
  }, [selectedAccountId, user, refreshProperties, refreshJobs, loadPreferences])

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
      refreshNotificationPreferences: () =>
        user && selectedAccountId ? loadPreferences(user, selectedAccountId) : Promise.resolve(),
      loading,
      error,
    }),
    [
      session,
      user,
      profile,
      accounts,
      selectedAccountId,
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
      loadPreferences,
      loading,
      error,
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
    const etaMinutes = Math.max(0, (etaFromField ?? 30) - minutesSinceStart)
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

  const fallbackEta = addMinutes(now, 20)
  return `~${differenceInMinutes(fallbackEta, now)} min`
}
