'use client'

import { useMemo } from 'react'
import clsx from 'clsx'
import { FunnelIcon } from '@heroicons/react/24/outline'
import type { Property } from './ClientPortalProvider'

export type PropertyFilterState = {
  search: string
  status: 'all' | 'active' | 'paused'
  binType: 'all' | 'landfill' | 'recycling' | 'organics'
  groupBy: 'city' | 'status'
}

const BIN_LABELS: Record<PropertyFilterState['binType'], string> = {
  all: 'All bins',
  landfill: 'Landfill',
  recycling: 'Recycling',
  organics: 'Organics',
}

const STATUS_LABELS: Record<PropertyFilterState['status'], string> = {
  all: 'All statuses',
  active: 'Active',
  paused: 'Paused',
}

export type PropertyFiltersProps = {
  filters: PropertyFilterState
  onChange: (next: PropertyFilterState) => void
  properties: Property[]
}

export function PropertyFilters({ filters, onChange, properties }: PropertyFiltersProps) {
  const totals = useMemo(() => {
    const totalBins = properties.reduce(
      (accumulator, property) => {
        property.binTypes.forEach((bin) => {
          if (bin.toLowerCase().includes('recycle')) accumulator.recycling += 1
          else if (bin.toLowerCase().includes('green') || bin.toLowerCase().includes('organic')) accumulator.organics += 1
          else accumulator.landfill += 1
        })
        return accumulator
      },
      { landfill: 0, recycling: 0, organics: 0 },
    )

    return totalBins
  }, [properties])

  const update = (partial: Partial<PropertyFilterState>) => {
    onChange({ ...filters, ...partial })
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4 text-white shadow-inner shadow-black/30">
      <div className="mb-4 flex items-center gap-2 text-sm text-white/60">
        <FunnelIcon className="h-5 w-5" />
        <span>Filter properties</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-white/60">Search</span>
          <input
            type="search"
            placeholder="Search by name or suburb"
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
            className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-white/60">Status</span>
          <div className="flex gap-2">
            {(Object.keys(STATUS_LABELS) as PropertyFilterState['status'][]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => update({ status })}
                className={clsx(
                  'flex-1 rounded-2xl border px-4 py-2 text-sm font-medium transition',
                  filters.status === status
                    ? 'border-binbird-red bg-binbird-red/20 text-white'
                    : 'border-white/10 bg-black/40 text-white/60 hover:border-binbird-red/40 hover:text-white',
                )}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-white/60">Bin type</span>
          <select
            value={filters.binType}
            onChange={(event) => update({ binType: event.target.value as PropertyFilterState['binType'] })}
            className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-white focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
          >
            {(Object.keys(BIN_LABELS) as PropertyFilterState['binType'][]).map((bin) => (
              <option key={bin} value={bin} className="bg-black">
                {BIN_LABELS[bin]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-white/60">Group by</span>
          <select
            value={filters.groupBy}
            onChange={(event) => update({ groupBy: event.target.value as PropertyFilterState['groupBy'] })}
            className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-white focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
          >
            <option value="city">City</option>
            <option value="status">Status</option>
          </select>
        </label>
      </div>
      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <dt className="text-xs uppercase tracking-wide text-white/50">Landfill bins</dt>
          <dd className="mt-1 text-2xl font-semibold">{totals.landfill}</dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <dt className="text-xs uppercase tracking-wide text-white/50">Recycling bins</dt>
          <dd className="mt-1 text-2xl font-semibold">{totals.recycling}</dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <dt className="text-xs uppercase tracking-wide text-white/50">Organics bins</dt>
          <dd className="mt-1 text-2xl font-semibold">{totals.organics}</dd>
        </div>
      </dl>
    </section>
  )
}
