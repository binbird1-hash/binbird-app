
'use client'

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

const BIN_BADGE_STYLES: Record<'garbage' | 'recycling' | 'compost', string> = {
  garbage: 'bg-red-600 text-white',
  recycling: 'bg-yellow-500 text-black',
  compost: 'bg-green-600 text-white',
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
                            <div className="space-y-1 text-xs uppercase tracking-wide text-white/50">
                              <p>Property code</p>
                              <p className="text-sm font-medium text-white normal-case">{property.id}</p>
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            {binSummaries.map((bin) => (
                              <div key={bin.key} className="flex items-center gap-3 rounded-2xl bg-black/40 p-3">
                                <span
                                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold ${BIN_BADGE_STYLES[bin.key]}`}
                                >
                                  {bin.count}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-white">{bin.label}</p>
                                  <p className="text-xs text-white/60">{bin.description}</p>
                                </div>
                              </div>
                            ))}
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
