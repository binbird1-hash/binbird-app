'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { CreditCardIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { saveAs } from 'file-saver'
import { useClientPortal } from './ClientPortalProvider'

type BillingRow = {
  id: string
  property: string
  address: string
  membership: string
  monthly: string
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
  const header = 'Property,Address,Membership start,Monthly fee\n'
  const body = rows
    .map((row) => [row.property, row.address, row.membership, row.monthly].map((cell) => `"${cell}"`).join(','))
    .join('\n')
  return `${header}${body}`
}

export function BillingOverview() {
  const { properties } = useClientPortal()

  const stats = useMemo(() => {
    if (properties.length === 0) {
      return {
        totalMonthly: 0,
        activeProperties: 0,
        rows: [] as BillingRow[],
      }
    }

    const rows = properties.map((property) => {
      const address = formatAddress(property)
      return {
        id: property.id,
        property: property.name,
        address: address || property.name,
        membership: property.membershipStart ? format(new Date(property.membershipStart), 'PP') : '—',
        monthly: property.pricePerMonth ? `$${property.pricePerMonth.toFixed(2)}` : 'Included',
        isActive: property.status === 'active',
        price: property.pricePerMonth ?? 0,
      }
    })

    const totalMonthly = rows.reduce((sum, row) => sum + (Number(row.price) || 0), 0)
    const activeProperties = rows.filter((row) => row.isActive).length

    return {
      totalMonthly,
      activeProperties,
      rows: rows.map(({ id, property, address, membership, monthly }) => ({
        id,
        property,
        address,
        membership,
        monthly,
      })),
    }
  }, [properties])

  const handleDownloadCsv = () => {
    const blob = new Blob([toCsv(stats.rows)], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, `binbird-billing-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <div className="space-y-6 text-white">
      <section className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-inner shadow-black/30">
        <span className="text-xs uppercase tracking-wide text-white/50">Billing overview</span>
        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <dt className="text-xs uppercase tracking-wide text-white/50">Monthly total (excl. tax)</dt>
            <dd className="mt-1 text-2xl font-semibold">
              {stats.totalMonthly > 0 ? `$${stats.totalMonthly.toFixed(2)}` : 'Included'}
            </dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <dt className="text-xs uppercase tracking-wide text-white/50">Active properties</dt>
            <dd className="mt-1 text-2xl font-semibold">{stats.activeProperties}</dd>
          </div>
        </dl>
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
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-white/40">
                <tr>
                  <th className="px-4 py-3">Property</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Membership</th>
                  <th className="px-4 py-3">Monthly fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-white">{row.property}</td>
                    <td className="px-4 py-3 text-white/70">{row.address}</td>
                    <td className="px-4 py-3 text-white/70">{row.membership}</td>
                    <td className="px-4 py-3 text-white">{row.monthly}</td>
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
