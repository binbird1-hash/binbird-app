'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { addMonths, format, formatDistanceToNowStrict, startOfMonth } from 'date-fns'
import {
  CreditCardIcon,
  ArrowPathIcon,
  BuildingOffice2Icon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline'
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
const PROPERTY_REQUEST_URL = process.env.NEXT_PUBLIC_PROPERTY_REQUEST_URL

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

  const handleManageSubscription = () => {
    if (typeof window === 'undefined') return
    if (BILLING_PORTAL_URL) {
      window.open(BILLING_PORTAL_URL, '_blank', 'noopener,noreferrer')
      return
    }
    window.open('mailto:billing@binbird.com?subject=Manage%20my%20BinBird%20subscription', '_blank')
  }

  const handleAddProperty = () => {
    if (typeof window === 'undefined') return
    if (PROPERTY_REQUEST_URL) {
      window.open(PROPERTY_REQUEST_URL, '_blank', 'noopener,noreferrer')
      return
    }
    window.open('mailto:hello@binbird.com?subject=Add%20a%20new%20property%20to%20my%20account', '_blank')
  }

  const handleUpdateBillingDetails = () => {
    router.push('/client/settings')
  }

  return (
    <div className="space-y-6 text-white">
      <section className="rounded-3xl border border-white/10 bg-black p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-wide text-white/40">Billing snapshot</span>
            <p className="mt-1 text-sm text-white/60">
              Current totals for your connected properties and upcoming invoice
            </p>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black p-4">
            <dt className="text-xs uppercase tracking-wide text-white/50">Monthly total (excl. tax)</dt>
            <dd className="mt-2 text-3xl font-semibold tracking-tight">
              {stats.totalMonthly > 0 ? currencyFormatter.format(stats.totalMonthly) : 'Included'}
            </dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black p-4">
            <dt className="text-xs uppercase tracking-wide text-white/50">Active properties</dt>
            <dd className="mt-2 text-3xl font-semibold tracking-tight">{stats.activeProperties}</dd>
            {stats.pausedProperties > 0 && (
              <dd className="mt-3 text-xs text-white/50">{stats.pausedProperties} paused</dd>
            )}
          </div>
        </dl>
      </section>

      <section className="rounded-3xl border border-white/10 bg-black p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-wide text-white/40">Manage your account</span>
            <p className="mt-1 text-sm text-white/60">
              Keep your subscription current, maintain billing contacts, and request new properties
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-black p-5">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-3 text-sm font-medium text-white">
                <ArrowPathIcon className="h-5 w-5" /> Manage subscription
              </div>
              <p className="text-sm text-white/60">
                {selectedAccount ? `${selectedAccount.name} is on the ${planName}.` : 'Review your plan details.'}
                {stats.activeProperties > 0 && (
                  <>
                    {' '}
                    Next invoice {format(stats.nextBillingDate, 'PPP')} (
                    {formatDistanceToNowStrict(stats.nextBillingDate, { addSuffix: true })}).
                  </>
                )}
              </p>
              <dl className="grid gap-2 text-xs text-white/60">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black px-3 py-2">
                  <dt className="uppercase tracking-wide">Monthly spend</dt>
                  <dd className="font-semibold text-white">
                    {stats.totalMonthly > 0 ? currencyFormatter.format(stats.totalMonthly) : 'Included'}
                  </dd>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black px-3 py-2">
                  <dt className="uppercase tracking-wide">Properties</dt>
                  <dd className="font-semibold text-white">
                    {stats.activeProperties} active · {stats.pausedProperties} paused
                  </dd>
                </div>
              </dl>
            </div>
            <button
              type="button"
              onClick={handleManageSubscription}
              className="mt-6 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-binbird-red hover:text-binbird-red"
            >
              Manage subscription
            </button>
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-black p-5">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-3 text-sm font-medium text-white">
                <DocumentDuplicateIcon className="h-5 w-5" /> Billing contacts
              </div>
              <p className="text-sm text-white/60">
                Confirm who receives invoices and reminders so nothing is missed.
              </p>
              <dl className="space-y-2 text-sm text-white">
                <div className="rounded-xl border border-white/10 bg-black px-3 py-2">
                  <dt className="text-xs uppercase tracking-wide text-white/50">Primary email</dt>
                  <dd className="mt-1 font-medium text-white">
                    {user?.email ?? 'Not set'}
                  </dd>
                </div>
                <div className="rounded-xl border border-white/10 bg-black px-3 py-2">
                  <dt className="text-xs uppercase tracking-wide text-white/50">Account contact</dt>
                  <dd className="mt-1 font-medium text-white">
                    {profile?.fullName ?? 'Add a billing contact'}
                  </dd>
                  {profile?.phone && <dd className="text-xs text-white/50">{profile.phone}</dd>}
                </div>
              </dl>
            </div>
            <button
              type="button"
              onClick={handleUpdateBillingDetails}
              className="mt-6 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-binbird-red hover:text-binbird-red"
            >
              Update billing details
            </button>
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-black p-5">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-3 text-sm font-medium text-white">
                <BuildingOffice2Icon className="h-5 w-5" /> Property management
              </div>
              <p className="text-sm text-white/60">
                Track which sites are active, request new connections, or pause locations that are on hold.
              </p>
              <ul className="space-y-2 text-xs text-white/60">
                <li className="rounded-xl border border-white/10 bg-black px-3 py-2">
                  <span className="font-semibold text-white">{stats.activeProperties}</span> active properties scheduled this
                  month
                </li>
                {stats.pausedProperties > 0 && (
                  <li className="rounded-xl border border-white/10 bg-black px-3 py-2">
                    <span className="font-semibold text-white">{stats.pausedProperties}</span> paused until reactivated
                  </li>
                )}
                <li className="rounded-xl border border-white/10 bg-black px-3 py-2">
                  Projected monthly catalogue value:{' '}
                  {stats.catalogMonthly > 0 ? currencyFormatter.format(stats.catalogMonthly) : 'Included'}
                </li>
              </ul>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAddProperty}
                className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-binbird-red hover:text-binbird-red"
              >
                Add property
              </button>
              <Link
                href="/client/dashboard"
                className="inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-binbird-red hover:text-binbird-red"
              >
                View property list
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-inner shadow-black/30">
        <header className="mb-4 flex items-center justify-between text-sm text-white/60">
          <span className="inline-flex items-center gap-3">
            <CreditCardIcon className="h-5 w-5" /> Property billing summary
          </span>
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
    </div>
  )
}
