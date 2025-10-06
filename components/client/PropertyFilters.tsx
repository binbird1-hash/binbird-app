'use client'

import { useId, useMemo } from 'react'
import { FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline'
import type { Property } from './ClientPortalProvider'

export type PropertyFilterState = {
  search: string
}

export type PropertyFiltersProps = {
  filters: PropertyFilterState
  onChange: (next: PropertyFilterState) => void
  properties: Property[]
}

const formatAddress = (property: Property) => {
  const seen = new Set<string>()
  const parts = [property.addressLine, property.suburb, property.city]
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

const formatBinTotal = (value: number) => (value > 0 ? value : 0)

const isRedundantPropertyLabel = (label: string, property: Property, fullAddress: string | null) => {
  const normalizedLabel = label.trim().toLowerCase()
  if (!normalizedLabel) return true

  const normalizedAddressLine = property.addressLine?.trim().toLowerCase()
  if (normalizedAddressLine && normalizedAddressLine === normalizedLabel) {
    return true
  }

  if (fullAddress) {
    const normalizedFullAddress = fullAddress.toLowerCase()
    if (normalizedFullAddress === normalizedLabel) {
      return true
    }
    if (normalizedFullAddress.startsWith(`${normalizedLabel},`)) {
      return true
    }
  }

  return false
}

export function PropertyFilters({ filters, onChange, properties }: PropertyFiltersProps) {
  const totals = useMemo(() => {
    return properties.reduce(
      (accumulator, property) => {
        accumulator.garbage += property.binCounts?.garbage ?? 0
        accumulator.recycling += property.binCounts?.recycling ?? 0
        accumulator.compost += property.binCounts?.compost ?? 0
        return accumulator
      },
      { garbage: 0, recycling: 0, compost: 0 },
    )
  }, [properties])

  const searchSuggestions = useMemo(() => {
    const suggestions = new Set<string>()

    properties.forEach((property) => {
      const fullAddress = formatAddress(property)
      if (fullAddress) {
        suggestions.add(fullAddress)
      }

      const name = property.name?.trim()
      if (name && !isRedundantPropertyLabel(name, property, fullAddress)) {
        suggestions.add(name)
      }
    })

    return Array.from(suggestions).sort((a, b) => a.localeCompare(b))
  }, [properties])

  const searchInputId = useId()
  const matchingSuggestions = useMemo(() => {
    if (!filters.search) {
      return []
    }
    const term = filters.search.toLowerCase()
    return searchSuggestions
      .filter((suggestion) => {
        const normalized = suggestion.toLowerCase()
        if (normalized === term) {
          return false
        }
        return normalized.includes(term)
      })
      .slice(0, 10)
  }, [filters.search, searchSuggestions])

  const update = (partial: Partial<PropertyFilterState>) => {
    onChange({ ...filters, ...partial })
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-4 text-white shadow-inner shadow-black/30">
      <div className="mb-4 flex items-center gap-2 text-sm text-white/60">
        <FunnelIcon className="h-5 w-5" />
        <span>Filter properties</span>
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full max-w-2xl flex-col gap-2 text-sm">
          <label className="text-white/60" htmlFor={searchInputId}>
            Search
          </label>
          <div className="relative">
            <input
              id={searchInputId}
              type="search"
              autoComplete="off"
              placeholder="Search by name or suburb"
              value={filters.search}
              onChange={(event) => update({ search: event.target.value })}
              className="w-full appearance-none rounded-2xl border border-white/10 bg-black/40 px-4 py-2 pr-12 text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            />
            {filters.search ? (
              <button
                type="button"
                onClick={() => update({ search: '' })}
                className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Clear search"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            ) : null}
            {matchingSuggestions.length > 0 && (
              <ul className="absolute left-0 right-0 z-20 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-white/10 bg-black/80 p-2 backdrop-blur">
                {matchingSuggestions.map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault()
                        update({ search: suggestion })
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm text-white transition hover:bg-binbird-red/20"
                    >
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <dl className="grid flex-1 gap-3 sm:grid-cols-3 md:auto-cols-fr md:grid-flow-col">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <dt className="text-xs uppercase tracking-wide text-white/50">Garbage bins</dt>
            <dd className="mt-1 text-2xl font-semibold">{formatBinTotal(totals.garbage)}</dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <dt className="text-xs uppercase tracking-wide text-white/50">Recycling bins</dt>
            <dd className="mt-1 text-2xl font-semibold">{formatBinTotal(totals.recycling)}</dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <dt className="text-xs uppercase tracking-wide text-white/50">Compost bins</dt>
            <dd className="mt-1 text-2xl font-semibold">{formatBinTotal(totals.compost)}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
