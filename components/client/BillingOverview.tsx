'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { addMonths, format, startOfMonth } from 'date-fns'
import { CreditCardIcon } from '@heroicons/react/24/outline'
import { useClientPortal } from './ClientPortalProvider'
import { AddPropertyDialog } from './AddPropertyDialog'

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

const BILLING_PORTAL_URL =
  process.env.NEXT_PUBLIC_BILLING_PORTAL_URL ??
  'https://billing.stripe.com/p/login/8x2dR8gWu3i84Kp39sdZ600'

export function BillingOverview() {
  const { properties, user, selectedAccount } = useClientPortal()
  const [isAddPropertyOpen, setAddPropertyOpen] = useState(false)

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
        membership: property.membershipStart
          ? format(new Date(property.membershipStart), 'PP')
          : '—',
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

  const handleAddProperty = () => {
    setAddPropertyOpen(true)
  }

  return (
    <>
      <div className="space-y-6 text-slate-900">
        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-wide text-slate-400">Plan snapshot</span>
              <p className="mt-1 text-sm text-slate-500">
                Review your current monthly total and manage your plan.
              </p>
            </div>
          </div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Monthly total (excl. tax)</dt>
              <dd className="mt-2 text-3xl font-semibold tracking-tight">
                {stats.totalMonthly > 0 ? currencyFormatter.format(stats.totalMonthly) : 'Included'}
              </dd>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Active properties</dt>
              <dd className="mt-2 text-3xl font-semibold tracking-tight">{stats.activeProperties}</dd>
              {stats.pausedProperties > 0 && (
                <dd className="mt-3 text-xs text-slate-500">{stats.pausedProperties} paused</dd>
              )}
            </div>
          </dl>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-slate-100 p-6 shadow-inner shadow-slate-200/70">
          <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-3 text-sm text-slate-500">
              <CreditCardIcon className="h-5 w-5" /> Property plan summary
            </span>
            <div className="flex flex-wrap gap-3">
              <Link
                href={BILLING_PORTAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-binbird-red px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-red-900/40 transition hover:bg-red-500"
              >
                Manage plan
              </Link>
              <button
                type="button"
                onClick={handleAddProperty}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-binbird-red px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-red-900/40 transition hover:bg-red-500"
              >
                Add property
              </button>
            </div>
          </header>
          {stats.rows.length === 0 ? (
            <p className="text-sm text-slate-500">
              No plan data yet. Add properties to see plan details here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed divide-y divide-white/10 text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="w-1/2 px-4 py-3">Property</th>
                    <th className="w-1/4 px-4 py-3">Membership start date</th>
                    <th className="w-1/4 px-4 py-3 text-right">Monthly fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {stats.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-100">
                      <td className="px-4 py-3 align-top text-slate-900">
                        <div>{row.propertyPrimary}</div>
                        {row.propertySecondary && (
                          <div className="text-sm text-slate-500">{row.propertySecondary}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top text-slate-600">
                        {row.membershipStart}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-900">{row.monthly}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <AddPropertyDialog
        isOpen={isAddPropertyOpen}
        onClose={() => setAddPropertyOpen(false)}
        accountName={selectedAccount?.name}
        accountId={selectedAccount?.id}
        requesterEmail={user?.email ?? undefined}
      />
    </>
  )
}
