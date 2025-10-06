
'use client'

import { CalendarIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useCallback, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import type { Property } from './ClientPortalProvider'
import { PropertyFilters, type PropertyFilterState } from './PropertyFilters'

const DEFAULT_FILTERS: PropertyFilterState = {
  search: '',
}

function matchesFilters(property: Property, filters: PropertyFilterState) {
  if (filters.search) {
    const term = filters.search.toLowerCase()
    const candidates = [property.name, property.addressLine, property.suburb, property.city]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase())
    if (!candidates.some((value) => value.includes(term))) {
      return false
    }
  }
  return true
}

function groupProperties(properties: Property[]) {
  return properties.reduce<Record<string, Property[]>>((groups, property) => {
    const key = property.city || 'Unassigned'
    groups[key] = groups[key] ? [...groups[key], property] : [property]
    return groups
  }, {})
}

const BIN_THEME: Record<
  'garbage' | 'recycling' | 'compost',
  {
    surface: string
    pill: string
    label: string
    frequency: string
  }
> = {
  garbage: {
    surface:
      'border-red-500/20 bg-gradient-to-br from-red-500/15 via-red-500/5 to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]',
    pill: 'bg-red-500 text-white shadow-[0_5px_20px_-12px_rgba(248,113,113,0.9)]',
    label: 'text-red-200/70',
    frequency: 'bg-red-500/15 text-red-100/80 ring-1 ring-inset ring-red-500/30',
  },
  recycling: {
    surface:
      'border-yellow-400/30 bg-gradient-to-br from-yellow-500/20 via-yellow-500/5 to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
    pill: 'bg-yellow-400 text-black shadow-[0_5px_20px_-12px_rgba(234,179,8,0.9)]',
    label: 'text-yellow-100/80',
    frequency: 'bg-yellow-400/20 text-yellow-950/70 ring-1 ring-inset ring-yellow-400/40',
  },
  compost: {
    surface:
      'border-green-500/20 bg-gradient-to-br from-green-500/15 via-green-500/5 to-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
    pill: 'bg-green-500 text-white shadow-[0_5px_20px_-12px_rgba(34,197,94,0.9)]',
    label: 'text-green-100/80',
    frequency: 'bg-green-500/15 text-green-100/80 ring-1 ring-inset ring-green-500/30',
  },
}

const formatBinFrequency = (description: string | null) => {
  if (!description) return 'Schedule not set'
  const frequencyMatch = description.match(/\(([^)]+)\)/)
  const frequency = frequencyMatch?.[1]
  const extras: string[] = []
  if (frequency) {
    const cleaned = frequency.charAt(0).toUpperCase() + frequency.slice(1)
    extras.push(cleaned)
  }
  if (/alternate weeks/i.test(description)) {
    extras.push('Alternate weeks')
  }
  if (extras.length === 0) {
    return 'Schedule not set'
  }
  return extras.join(', ')
}

export type PropertyDashboardProps = {
  properties: Property[]
  isLoading: boolean
}

export function PropertyDashboard({ properties, isLoading }: PropertyDashboardProps) {
  const router = useRouter()
  const [filters, setFilters] = useState<PropertyFilterState>(DEFAULT_FILTERS)

  const filtered = useMemo(() => properties.filter((property) => matchesFilters(property, filters)), [properties, filters])
  const grouped = useMemo(() => groupProperties(filtered), [filtered])

  const handlePropertyClick = useCallback(
    (propertyId: string) => {
      router.push(`/client/(portal)/history?propertyId=${encodeURIComponent(propertyId)}`)
    },
    [router],
  )

  return (
    <div className="space-y-6 text-white">
      <PropertyFilters filters={filters} onChange={setFilters} properties={properties} />

      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-3xl border border-white/10 bg-white/5">
          <span className="flex items-center gap-3 text-white/60">
            <span className="h-2 w-2 animate-ping rounded-full bg-binbird-red" />
            Loading properties…
          </span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/20 bg-black/40 px-6 py-12 text-center text-white/60">
          <h3 className="text-lg font-semibold text-white">No properties found</h3>
          <p className="mt-2 text-sm">
            Adjust your filters or contact the BinBird team to connect additional properties to this account.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(grouped).map(([groupName, groupProperties]) => {
            const propertyCount = groupProperties.length
            const propertyCountLabel = `${propertyCount} ${propertyCount === 1 ? 'property' : 'properties'}`
            return (
              <section key={groupName} className="space-y-4">
                <header className="flex items-center justify-between text-sm text-white/60">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{groupName}</h3>
                    <p>{propertyCountLabel}</p>
                  </div>
                </header>
                <div className="grid auto-rows-fr gap-4 md:grid-cols-2">
                  {groupProperties.map((property) => {
                    const addressParts = [property.addressLine, property.suburb].filter((part) => part && part.trim().length > 0)
                    const address = addressParts.join(', ')
                    const binSummaries: Array<{
                      key: 'garbage' | 'recycling' | 'compost'
                      label: string
                      count: number
                      description: string
                    }> = [
                      {
                        key: 'garbage',
                        label: 'Garbage',
                        count: property.binCounts.garbage,
                        description: formatBinFrequency(property.binDescriptions.garbage),
                      },
                      {
                        key: 'recycling',
                        label: 'Recycling',
                        count: property.binCounts.recycling,
                        description: formatBinFrequency(property.binDescriptions.recycling),
                      },
                      {
                        key: 'compost',
                        label: 'Compost',
                        count: property.binCounts.compost,
                        description: formatBinFrequency(property.binDescriptions.compost),
                      },
                    ]

                    return (
                      <button
                        key={property.id}
                        type="button"
                        onClick={() => handlePropertyClick(property.id)}
                        className="group flex h-full min-h-[320px] flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-binbird-red hover:bg-binbird-red/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red"
                        aria-label={`View job history for ${property.name}`}
                      >
                        <div className="flex flex-1 flex-col gap-6">
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <h4 className="text-xl font-semibold text-white">
                                {address || property.name}
                              </h4>
                              {property.name && address && property.name !== address && (
                                <p className="text-sm text-white/60">{property.name}</p>
                              )}
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {binSummaries.map((bin) => (
                                <div
                                  key={bin.key}
                                  className={clsx(
                                    'flex h-full flex-col justify-between rounded-2xl border px-4 py-5 transition-colors',
                                    BIN_THEME[bin.key].surface,
                                  )}
                                >
                                  <div className="flex flex-col gap-2">
                                    <span
                                      className={clsx(
                                        'inline-flex min-h-[3rem] w-full items-center justify-center rounded-full px-4 text-sm font-semibold leading-tight shadow-sm transition-colors sm:text-base',
                                        BIN_THEME[bin.key].pill,
                                      )}
                                    >
                                      {bin.count} {bin.label} {bin.count === 1 ? 'Bin' : 'Bins'}
                                    </span>
                                    <span
                                      className={clsx(
                                        'text-[11px] font-semibold uppercase tracking-wide',
                                        BIN_THEME[bin.key].label,
                                      )}
                                    >
                                      Collection frequency
                                    </span>
                                  </div>
                                  <div
                                    className={clsx(
                                      'mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium',
                                      bin.description === 'Schedule not set'
                                        ? 'border border-white/10 bg-white/5 text-white/60'
                                        : BIN_THEME[bin.key].frequency,
                                    )}
                                  >
                                    <CalendarIcon className="h-4 w-4" aria-hidden />
                                    <span>{bin.description}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="mt-6 space-y-2 text-sm text-white/60">
                          <p>
                            Next service:
                            <span className="ml-2 font-medium text-white">
                              {property.nextServiceAt ? format(new Date(property.nextServiceAt), 'EEE, MMM d') : 'Awaiting schedule'}
                            </span>
                          </p>
                          <p className="text-xs text-white/50">
                            Put out: {property.putOutDay ?? '—'} · Collection: {property.collectionDay ?? '—'}
                          </p>
                        </div>
                        <div className="mt-6 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-white/60">
                          <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-white">
                            Total bins: {property.binCounts.total}
                          </span>
                          <span className="flex items-center gap-2 text-white/70 transition group-hover:text-white">
                            View job history <span aria-hidden>→</span>
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
