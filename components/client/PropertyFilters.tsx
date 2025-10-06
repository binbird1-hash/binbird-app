'use client'

import { useMemo } from 'react'
import clsx from 'clsx'
import { FunnelIcon } from '@heroicons/react/24/outline'
import type { Property } from './ClientPortalProvider'
import { formatBinLabel } from '@/lib/binLabels'

export type PropertyFilterState = {
  search: string
  status: 'all' | 'active' | 'paused'
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
          const label = formatBinLabel(bin)
          if (label === 'Recycling') accumulator.recycling += 1
          else if (label === 'Compost') accumulator.compost += 1
          else if (label === 'Garbage') accumulator.garbage += 1
        })
        return accumulator
      },
      { garbage: 0, recycling: 0, compost: 0 },
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
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-white/60">Search</span>
          <input
            type="search"
            placeholder="Search by name or suburb"
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-white/60">Status</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STATUS_LABELS) as PropertyFilterState['status'][]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => update({ status })}
                className={clsx(
                  'flex-1 rounded-2xl border px-4 py-2 text-sm font-medium transition sm:flex-none sm:px-6 min-w-[120px]',
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
      </div>
      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <dt className="text-xs uppercase tracking-wide text-white/50">Garbage bins</dt>
          <dd className="mt-1 text-2xl font-semibold">{totals.garbage}</dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <dt className="text-xs uppercase tracking-wide text-white/50">Recycling bins</dt>
          <dd className="mt-1 text-2xl font-semibold">{totals.recycling}</dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <dt className="text-xs uppercase tracking-wide text-white/50">Compost bins</dt>
          <dd className="mt-1 text-2xl font-semibold">{totals.compost}</dd>
        </div>
      </dl>
    </section>
  )
}
