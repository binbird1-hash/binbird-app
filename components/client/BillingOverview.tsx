'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { CreditCardIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { saveAs } from 'file-saver'
import { useClientPortal } from './ClientPortalProvider'

function toCsv(rows: { property: string; membership: string; trial: string; monthly: string }[]) {
  const header = 'Property,Membership start,Trial start,Monthly fee\n'
  const body = rows
    .map((row) => [row.property, row.membership, row.trial, row.monthly].map((cell) => `"${cell}"`).join(','))
    .join('\n')
  return `${header}${body}`
}

export function BillingOverview() {
  const { properties, selectedAccount } = useClientPortal()

  const stats = useMemo(() => {
    if (properties.length === 0) {
      return {
        totalMonthly: 0,
        activeProperties: 0,
        trialProperties: 0,
        rows: [] as { property: string; membership: string; trial: string; monthly: string }[],
      }
    }

    const rows = properties.map((property) => ({
      id: property.id,
      property: property.name,
      membership: property.membershipStart ? format(new Date(property.membershipStart), 'PP') : '—',
      trial: property.trialStart ? format(new Date(property.trialStart), 'PP') : '—',
      monthly: property.pricePerMonth ? `$${property.pricePerMonth.toFixed(2)}` : 'Included',
      isActive: property.status === 'active',
      isTrial: !property.membershipStart && property.trialStart !== null,
      price: property.pricePerMonth ?? 0,
    }))

    const totalMonthly = rows.reduce((sum, row) => sum + (Number(row.price) || 0), 0)
    const activeProperties = rows.filter((row) => row.isActive).length
    const trialProperties = rows.filter((row) => row.isTrial).length

    return {
      totalMonthly,
      activeProperties,
      trialProperties,
      rows: rows.map(({ id, property, membership, trial, monthly }) => ({ id, property, membership, trial, monthly })),
    }
  }, [properties])

  const planName = stats.totalMonthly > 0 ? 'Managed service' : stats.trialProperties > 0 ? 'Trial' : 'Starter'

  const handleDownloadCsv = () => {
    const blob = new Blob([toCsv(stats.rows)], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, `binbird-billing-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <div className="space-y-6 text-white">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-black/30">
        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-white/50">Current plan</span>
          <h3 className="text-2xl font-semibold text-white">{planName}</h3>
          <p className="text-sm text-white/60">
            Billing reflects the properties connected to{' '}
            <span className="font-medium text-white">{selectedAccount?.name ?? 'your account'}</span>. Contact support to
            adjust pricing or add new sites.
          </p>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <dt className="text-xs uppercase tracking-wide text-white/50">Monthly total</dt>
            <dd className="mt-1 text-2xl font-semibold">
              {stats.totalMonthly > 0 ? `$${stats.totalMonthly.toFixed(2)}` : 'Included'}
            </dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <dt className="text-xs uppercase tracking-wide text-white/50">Active properties</dt>
            <dd className="mt-1 text-2xl font-semibold">{stats.activeProperties}</dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <dt className="text-xs uppercase tracking-wide text-white/50">On trial</dt>
            <dd className="mt-1 text-2xl font-semibold">{stats.trialProperties}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-inner shadow-black/30">
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
                  <th className="px-4 py-3">Membership</th>
                  <th className="px-4 py-3">Trial</th>
                  <th className="px-4 py-3">Monthly fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-white">{row.property}</td>
                    <td className="px-4 py-3 text-white/70">{row.membership}</td>
                    <td className="px-4 py-3 text-white/70">{row.trial}</td>
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
