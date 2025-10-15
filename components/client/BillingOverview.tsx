'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { addMonths, format, formatDistanceToNowStrict, startOfMonth } from 'date-fns'
import {
  CreditCardIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  BuildingOffice2Icon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline'
import { saveAs } from 'file-saver'
import { ManageSubscriptionModal, type SubscriptionPreferences } from './ManageSubscriptionModal'
import { AddPropertyModal, type AddPropertyRequest } from './AddPropertyModal'
import { useClientPortal } from './ClientPortalProvider'

type BillingRow = {
  id: string
  propertyPrimary: string
  propertySecondary?: string
  membershipStart: string
  monthly: string
}

type BillingStats = {
  totalMonthly: number
  catalogMonthly: number
  activeProperties: number
  pausedProperties: number
  includedProperties: number
  averagePerProperty: number
  nextBillingDate: Date
  annualProjection: number
  rows: BillingRow[]
}

function formatAddress({
  addressLine,
  suburb,
  city,
}: {
  addressLine: string
  suburb: string
  city: string
}) {
  const seen = new Set<string>()
  const parts = [addressLine, suburb, city]
    .map((part) => part?.trim())
    .filter((part): part is string => {
      if (!part) {
        return false
      }
      const lower = part.toLowerCase()
      if (seen.has(lower)) {
        return false
      }
      seen.add(lower)
      return true
    })
  return parts.join(', ')
}

function toCsv(rows: BillingRow[]) {
  const header = 'Property,Membership start date,Monthly fee\n'
  const body = rows
    .map((row) => {
      const property = row.propertySecondary
        ? `${row.propertyPrimary} - ${row.propertySecondary}`
        : row.propertyPrimary
      return [property, row.membershipStart, row.monthly].map((cell) => `"${cell}"`).join(',')
    })
    .join('\n')
  return `${header}${body}`
}

function formatPropertyDisplay({
  name,
  addressLine,
  suburb,
  city,
}: {
  name: string
  addressLine: string
  suburb: string
  city: string
}) {
  const trimmedName = name?.trim() ?? ''
  const address = formatAddress({ addressLine, suburb, city })
  const primaryAddressPart = addressLine?.trim() ?? ''

  if (!address) {
    return { primary: trimmedName || 'Property', secondary: undefined }
  }

  const normalizedName = trimmedName.toLowerCase()
  const normalizedPrimaryAddress = primaryAddressPart.toLowerCase()
  const normalizedAddress = address.toLowerCase()

  const nameMatchesPrimary = normalizedName && normalizedName === normalizedPrimaryAddress
  const nameMatchesAddressStart =
    normalizedName && normalizedAddress.startsWith(`${normalizedName},`)

  if (!trimmedName || nameMatchesPrimary || nameMatchesAddressStart) {
    return { primary: address, secondary: undefined }
  }

  return { primary: trimmedName, secondary: address }
}

const BILLING_PORTAL_URL = process.env.NEXT_PUBLIC_BILLING_PORTAL_URL

type PendingPropertyRequest = AddPropertyRequest & { id: string; createdAt: Date }

const PLAN_NAME_TO_TIER: Record<string, SubscriptionPreferences['planTier']> = {
  'Paused plan': 'paused',
  'Starter plan': 'starter',
  'Growth plan': 'growth',
  'Enterprise plan': 'enterprise',
}

const PLAN_TIER_LABELS: Record<SubscriptionPreferences['planTier'], string> = {
  paused: 'Paused plan',
  starter: 'Starter plan',
  growth: 'Growth plan',
  enterprise: 'Enterprise plan',
}

const SERVICE_LEVEL_LABELS: Record<AddPropertyRequest['serviceLevel'], string> = {
  standard: 'Standard servicing',
  catalog: 'Full catalog management',
  custom: 'Custom program',
}

export function BillingOverview() {
  const router = useRouter()
  const { properties, profile, user, selectedAccount } = useClientPortal()

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 2,
      }),
    [],
  )

  const stats = useMemo<BillingStats>(() => {
    if (properties.length === 0) {
      return {
        totalMonthly: 0,
        catalogMonthly: 0,
        activeProperties: 0,
        pausedProperties: 0,
        includedProperties: 0,
        averagePerProperty: 0,
        nextBillingDate: startOfMonth(addMonths(new Date(), 1)),
        annualProjection: 0,
        rows: [] as BillingRow[],
      }
    }

    const rows = properties.map((property) => {
      const { primary, secondary } = formatPropertyDisplay(property)
      return {
        id: property.id,
        primary,
        secondary,
        membership: property.membershipStart ? format(new Date(property.membershipStart), 'PP') : '—',
        monthly: property.pricePerMonth ? `$${property.pricePerMonth.toFixed(2)}` : 'Included',
        isActive: property.status === 'active',
        price: property.pricePerMonth ?? 0,
      }
    })

    const activeRows = rows.filter((row) => row.isActive)
    const pausedRows = rows.filter((row) => !row.isActive)
    const totalMonthly = activeRows.reduce((sum, row) => sum + (Number(row.price) || 0), 0)
    const pausedMonthly = pausedRows.reduce((sum, row) => sum + (Number(row.price) || 0), 0)
    const activeProperties = activeRows.length
    const pausedProperties = pausedRows.length
    const includedProperties = activeRows.filter((row) => (Number(row.price) || 0) === 0).length

    const nextBillingDate = startOfMonth(addMonths(new Date(), 1))

    const averagePerProperty = activeProperties > 0 ? totalMonthly / activeProperties : 0
    const annualProjection = totalMonthly * 12

    return {
      totalMonthly,
      catalogMonthly: totalMonthly + pausedMonthly,
      activeProperties,
      pausedProperties,
      includedProperties,
      averagePerProperty,
      nextBillingDate,
      annualProjection,
      rows: rows.map(({ id, primary, secondary, membership, monthly }) => ({
        id,
        propertyPrimary: primary,
        propertySecondary: secondary,
        membershipStart: membership,
        monthly,
      })),
    }
  }, [properties])

  const planName = useMemo(() => {
    if (stats.activeProperties === 0) {
      return 'Paused plan'
    }
    if (stats.activeProperties <= 3) {
      return 'Starter plan'
    }
    if (stats.activeProperties <= 10) {
      return 'Growth plan'
    }
    return 'Enterprise plan'
  }, [stats.activeProperties])

  const [isManageSubscriptionOpen, setIsManageSubscriptionOpen] = useState(false)
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false)
  const [subscriptionPreferences, setSubscriptionPreferences] = useState<SubscriptionPreferences>(() => ({
    planTier: PLAN_NAME_TO_TIER[planName] ?? 'starter',
    billingFrequency: 'monthly',
    autopayEnabled: true,
    invoiceEmail: user?.email ?? '',
    notes: '',
  }))
  const [subscriptionStatus, setSubscriptionStatus] = useState<{ message: string; timestamp: Date } | null>(null)
  const [pendingPropertyRequests, setPendingPropertyRequests] = useState<PendingPropertyRequest[]>([])
  const [propertyStatus, setPropertyStatus] = useState<{ message: string; timestamp: Date } | null>(null)

  useEffect(() => {
    if (subscriptionStatus) {
      return
    }
    setSubscriptionPreferences((previous) => ({
      ...previous,
      planTier: PLAN_NAME_TO_TIER[planName] ?? previous.planTier,
    }))
  }, [planName, subscriptionStatus])

  useEffect(() => {
    setSubscriptionPreferences((previous) => ({
      ...previous,
      invoiceEmail: user?.email ?? previous.invoiceEmail,
    }))
  }, [user?.email])

  const handleSaveSubscription = (preferences: SubscriptionPreferences) => {
    setSubscriptionPreferences(preferences)
    setSubscriptionStatus({
      message: 'Subscription preferences submitted to our team.',
      timestamp: new Date(),
    })
    setIsManageSubscriptionOpen(false)
  }

  const handleCreatePropertyRequest = (request: AddPropertyRequest) => {
    const entry: PendingPropertyRequest = {
      ...request,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date(),
    }
    setPendingPropertyRequests((previous) => [entry, ...previous])
    setPropertyStatus({
      message: 'Property request received. We will follow up shortly.',
      timestamp: new Date(),
    })
    setIsAddPropertyOpen(false)
  }

  const billingFrequencyLabel =
    subscriptionPreferences.billingFrequency === 'annual' ? 'Annual billing' : 'Monthly billing'
  const autopayLabel = subscriptionPreferences.autopayEnabled ? 'Auto-pay enabled' : 'Manual approval'
  const planTierLabel = PLAN_TIER_LABELS[subscriptionPreferences.planTier] ?? planName
  const formattedMonthlySpend = stats.totalMonthly > 0 ? currencyFormatter.format(stats.totalMonthly) : 'Included'
  const nextBillingDateDisplay = useMemo(() => format(stats.nextBillingDate, 'PPP'), [stats.nextBillingDate])

  const handleUpdateBillingDetails = () => {
    router.push('/client/settings')
  }

  const handleDownloadCsv = () => {
    const blob = new Blob([toCsv(stats.rows)], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, `binbird-billing-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <div className="space-y-6 text-white">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-6 shadow-inner shadow-black/40">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.2),transparent_70%)] opacity-80"
          aria-hidden="true"
        />
          <div className="relative z-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="text-xs uppercase tracking-wide text-white/40">Billing snapshot</span>
                <p className="mt-1 text-sm text-white/60">
                  Current totals for your connected properties and upcoming invoice
                </p>
              </div>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <dt className="text-xs uppercase tracking-wide text-white/50">Monthly total (excl. tax)</dt>
                <dd className="mt-2 text-3xl font-semibold tracking-tight">
                  {stats.totalMonthly > 0 ? currencyFormatter.format(stats.totalMonthly) : 'Included'}
                </dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <dt className="text-xs uppercase tracking-wide text-white/50">Active properties</dt>
                <dd className="mt-2 text-3xl font-semibold tracking-tight">{stats.activeProperties}</dd>
                {stats.pausedProperties > 0 && (
                  <dd className="mt-3 text-xs text-white/50">{stats.pausedProperties} paused</dd>
                )}
              </div>
            </dl>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-6 shadow-inner shadow-black/40">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.2),transparent_70%)] opacity-80"
            aria-hidden="true"
          />
          <div className="relative z-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="text-xs uppercase tracking-wide text-white/40">Manage your account</span>
                <p className="mt-1 text-sm text-white/60">
                  Keep your subscription current, maintain billing contacts, and request new properties
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/60 p-5 shadow-inner shadow-black/50 backdrop-blur">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(239,68,68,0.22),transparent_70%)] opacity-70"
              aria-hidden="true"
            />
            <div className="relative z-10 flex h-full flex-col">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-3 text-sm font-medium text-white">
                  <ArrowPathIcon className="h-5 w-5" /> Manage subscription
                </div>
                <p className="text-sm text-white/60">
                  {selectedAccount
                    ? `${selectedAccount.name} is currently aligned with the ${planTierLabel}.`
                    : 'Review your plan details.'}
                  {stats.activeProperties > 0 && (
                    <>
                      {' '}
                      Next invoice {nextBillingDateDisplay} (
                      {formatDistanceToNowStrict(stats.nextBillingDate, { addSuffix: true })}).
                    </>
                  )}
                </p>
                <dl className="grid gap-2 text-xs text-white/60">
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                    <dt className="uppercase tracking-wide">Monthly spend</dt>
                    <dd className="font-semibold text-white">{formattedMonthlySpend}</dd>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                    <dt className="uppercase tracking-wide">Properties</dt>
                    <dd className="font-semibold text-white">
                      {stats.activeProperties} active · {stats.pausedProperties} paused
                    </dd>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                    <dt className="uppercase tracking-wide">Billing</dt>
                    <dd className="font-semibold text-white">{billingFrequencyLabel}</dd>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                    <dt className="uppercase tracking-wide">Payments</dt>
                    <dd className="font-semibold text-white">{autopayLabel}</dd>
                  </div>
                </dl>
                {subscriptionStatus ? (
                  <p className="rounded-xl border border-binbird-red/40 bg-binbird-red/10 px-3 py-2 text-xs text-binbird-red/80">
                    {subscriptionStatus.message}{' '}
                    <span className="text-white/70">
                      Updated {formatDistanceToNowStrict(subscriptionStatus.timestamp, { addSuffix: true })}.
                    </span>
                  </p>
                ) : (
                  <p className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/60">
                    Manage plan updates and share context with the BinBird team.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsManageSubscriptionOpen(true)}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-binbird-red px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-900/40 transition hover:bg-red-500"
              >
                Manage subscription
              </button>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/60 p-5 shadow-inner shadow-black/50 backdrop-blur">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),transparent_70%)] opacity-60"
              aria-hidden="true"
            />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-3 text-sm font-medium text-white">
                  <DocumentDuplicateIcon className="h-5 w-5" /> Billing contacts
                </div>
                <p className="text-sm text-white/60">
                  Confirm who receives invoices and reminders so nothing is missed.
                </p>
                <dl className="space-y-2 text-sm text-white">
                  <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                    <dt className="text-xs uppercase tracking-wide text-white/50">Primary email</dt>
                    <dd className="mt-1 font-medium text-white">{user?.email ?? 'Not set'}</dd>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                    <dt className="text-xs uppercase tracking-wide text-white/50">Account contact</dt>
                    <dd className="mt-1 font-medium text-white">{profile?.fullName ?? 'Add a billing contact'}</dd>
                    {profile?.phone && <dd className="text-xs text-white/50">{profile.phone}</dd>}
                  </div>
                </dl>
              </div>
              <button
                type="button"
                onClick={handleUpdateBillingDetails}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-binbird-red hover:text-binbird-red"
              >
                Update billing details
              </button>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/60 p-5 shadow-inner shadow-black/50 backdrop-blur">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(34,197,94,0.18),transparent_70%)] opacity-60"
              aria-hidden="true"
            />
            <div className="relative z-10 flex h-full flex-col">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-3 text-sm font-medium text-white">
                  <BuildingOffice2Icon className="h-5 w-5" /> Property management
                </div>
                <p className="text-sm text-white/60">
                  Track which sites are active, request new connections, or pause locations that are on hold.
                </p>
                <ul className="space-y-2 text-xs text-white/60">
                  <li className="rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                    <span className="font-semibold text-white">{stats.activeProperties}</span> active properties scheduled this
                    month
                  </li>
                  {stats.pausedProperties > 0 && (
                    <li className="rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                      <span className="font-semibold text-white">{stats.pausedProperties}</span> paused until reactivated
                    </li>
                  )}
                  <li className="rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                    Projected monthly catalogue value{' '}
                    {stats.catalogMonthly > 0 ? currencyFormatter.format(stats.catalogMonthly) : 'Included'}
                  </li>
                </ul>
                {propertyStatus && (
                  <p className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                    {propertyStatus.message}{' '}
                    <span className="text-white/70">
                      {formatDistanceToNowStrict(propertyStatus.timestamp, { addSuffix: true })}
                    </span>
                  </p>
                )}
                {pendingPropertyRequests.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-black/45 px-3 py-3 text-xs text-white/70">
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Pending submissions</p>
                    <ul className="mt-2 space-y-2">
                      {pendingPropertyRequests.map((request) => {
                        const formattedAddress = formatAddress({
                          addressLine: request.addressLine,
                          suburb: request.suburb,
                          city: request.city,
                        })
                        const requestedStart = request.desiredStart ? format(new Date(request.desiredStart), 'PPP') : null
                        return (
                          <li key={request.id} className="rounded-lg border border-white/10 bg-black/60 px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-white">
                              <span className="text-sm font-semibold">{request.name}</span>
                              <span className="text-xs text-white/60">
                                {formatDistanceToNowStrict(request.createdAt, { addSuffix: true })}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-white/60">{formattedAddress}</div>
                            <div className="mt-1 text-xs text-white/60">
                              Service:{' '}
                              <span className="font-medium text-white">{SERVICE_LEVEL_LABELS[request.serviceLevel]}</span>
                            </div>
                            {requestedStart && (
                              <div className="mt-1 text-xs text-white/60">Target start {requestedStart}</div>
                            )}
                            {request.notes && (
                              <div className="mt-1 text-xs text-white/50">“{request.notes}”</div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddPropertyOpen(true)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-binbird-red hover:text-binbird-red"
                >
                  Add property
                </button>
                <Link
                  href="/client/dashboard"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-binbird-red hover:text-binbird-red"
                >
                  View property list
                </Link>
              </div>
            </div>
          </div>
            </div>
          </div>
        </section>

      <section className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-inner shadow-black/30">
        <header className="mb-4 flex items-center justify-between text-sm text-white/60">
          <span className="inline-flex items-center gap-3">
            <CreditCardIcon className="h-5 w-5" /> Property billing summary
          </span>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-white transition hover:border-binbird-red"
          >
            <ArrowDownTrayIcon className="h-4 w-4" /> Export CSV
          </button>
        </header>
        {stats.rows.length === 0 ? (
          <p className="text-sm text-white/60">No billing data yet. Add properties to see plan details here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed divide-y divide-white/10 text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-white/40">
                <tr>
                  <th className="w-1/2 px-4 py-3">Property</th>
                  <th className="w-1/4 px-4 py-3">Membership start date</th>
                  <th className="w-1/4 px-4 py-3 text-right">Monthly fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 align-top text-white">
                      <div>{row.propertyPrimary}</div>
                      {row.propertySecondary && (
                        <div className="text-sm text-white/60">{row.propertySecondary}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-white/70">{row.membershipStart}</td>
                    <td className="px-4 py-3 text-right text-white">{row.monthly}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <ManageSubscriptionModal
        isOpen={isManageSubscriptionOpen}
        onClose={() => setIsManageSubscriptionOpen(false)}
        onSave={handleSaveSubscription}
        initialPreferences={subscriptionPreferences}
        activeProperties={stats.activeProperties}
        formattedMonthlySpend={formattedMonthlySpend}
        nextBillingDate={stats.activeProperties > 0 ? nextBillingDateDisplay : undefined}
        planName={planTierLabel}
        portalUrl={BILLING_PORTAL_URL}
      />
      <AddPropertyModal
        isOpen={isAddPropertyOpen}
        onClose={() => setIsAddPropertyOpen(false)}
        onCreate={handleCreatePropertyRequest}
        existingPropertyCount={stats.activeProperties + stats.pausedProperties}
      />
    </div>
  )
}
