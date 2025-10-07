
'use client'

import clsx from 'clsx'
import { useCallback, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { CalendarDaysIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import type { Property } from './ClientPortalProvider'
import { PropertyFilters, type PropertyFilterState } from './PropertyFilters'
import { BIN_THEME, type BinThemeKey } from './binThemes'

const DEFAULT_FILTERS: PropertyFilterState = {
  search: '',
}

function matchesFilters(property: Property, filters: PropertyFilterState) {
  if (filters.search) {
    const lowerSearch = filters.search.toLowerCase()
    const terms = lowerSearch
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    const candidates = [property.name, property.addressLine, property.suburb, property.city]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase())

    if (terms.length === 0) {
      return true
    }

    const matchesAllTerms = terms.every((term) => candidates.some((value) => value.includes(term)))
    if (!matchesAllTerms) {
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

const getBinFrequencyInfo = (description: string | null, isFlip?: boolean) => {
  if (isFlip) {
    return { label: 'Alternate Fortnight', showCalendarIcon: true }
  }

  if (!description) {
    return { label: 'Schedule not set', showCalendarIcon: false }
  }

  const frequencyMatch = description.match(/\(([^)]+)\)/)
  const frequency = frequencyMatch?.[1]

  if (!frequency) {
    const trimmed = description.trim()
    if (!trimmed || /alternate/i.test(trimmed)) {
      return { label: 'Schedule not set', showCalendarIcon: false }
    }

    return { label: trimmed, showCalendarIcon: false }
  }

  const cleaned = frequency.charAt(0).toUpperCase() + frequency.slice(1)
  const normalized = cleaned.toLowerCase()

  const isFortnightly = normalized.includes('fortnight')
  const isWeekly = normalized.includes('week')

  return {
    label: cleaned,
    showCalendarIcon: isFortnightly || isWeekly,
  }
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
      router.push(`/client/history?propertyId=${encodeURIComponent(propertyId)}`)
    },
    [router],
  )

  return (
    <div className="space-y-6 text-white">
      <PropertyFilters filters={filters} onChange={setFilters} properties={properties} />

      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-3xl border border-white/15 bg-black/30">
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
          {Object.entries(grouped).map(([groupName, groupProperties], groupIndex) => {
            const propertyCount = groupProperties.length
            const propertyCountLabel = `${propertyCount} ${propertyCount === 1 ? 'property' : 'properties'}`
            return (
              <section
                key={groupName}
                className={clsx(
                  'relative overflow-hidden rounded-3xl border border-white/15 bg-black/25 px-6 py-6 backdrop-blur-sm',
                  "before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-white/30 before:opacity-80 before:content-['']",
                  {
                    'mt-2': groupIndex > 0,
                  },
                )}
              >
                <div className="space-y-4">
                  <header className="flex items-center justify-between text-sm text-white/60">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{groupName}</h3>
                      <p>{propertyCountLabel}</p>
                    </div>
                  </header>
                  <div className="h-px bg-white/10" />
                </div>
                <div className="grid auto-rows-fr grid-cols-1 gap-4 pt-4 sm:pt-6">
                  {groupProperties.map((property) => {
                    const seenAddressParts = new Set<string>()
                    const addressParts: string[] = []
                    ;[property.addressLine, property.suburb, property.city].forEach((part) => {
                      const trimmed = part?.trim()
                      if (!trimmed) return
                      const key = trimmed.toLowerCase()
                      if (seenAddressParts.has(key)) return
                      seenAddressParts.add(key)
                      addressParts.push(trimmed)
                    })
                    const address = addressParts.join(', ')
                    const propertyName = property.name?.trim()
                    const isNameDistinct =
                      Boolean(propertyName && address) && !address.toLowerCase().includes(propertyName.toLowerCase())
                    const binSummaries: Array<{
                      key: BinThemeKey
                      label: string
                      count: number
                      frequency: ReturnType<typeof getBinFrequencyInfo>
                    }> = [
                      {
                        key: 'garbage',
                        label: 'Garbage',
                        count: property.binCounts.garbage,
                        frequency: getBinFrequencyInfo(
                          property.binDescriptions.garbage,
                          property.binFlips.garbage,
                        ),
                      },
                      {
                        key: 'recycling',
                        label: 'Recycling',
                        count: property.binCounts.recycling,
                        frequency: getBinFrequencyInfo(
                          property.binDescriptions.recycling,
                          property.binFlips.recycling,
                        ),
                      },
                      {
                        key: 'compost',
                        label: 'Compost',
                        count: property.binCounts.compost,
                        frequency: getBinFrequencyInfo(
                          property.binDescriptions.compost,
                          property.binFlips.compost,
                        ),
                      },
                    ]

                    return (
                      <button
                        key={property.id}
                        type="button"
                        onClick={() => handlePropertyClick(property.id)}
                className="group flex h-full w-full flex-col rounded-3xl border border-white/15 bg-black/30 px-5 py-6 text-left transition hover:border-binbird-red hover:bg-binbird-red/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red sm:px-6"
                        aria-label={`View job history for ${property.name}`}
                      >
                        <div className="flex flex-col gap-4">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <h4 className="text-xl font-semibold text-white">
                                {address || property.name}
                              </h4>
                              {property.name && address && isNameDistinct && (
                                <p className="text-sm text-white/60">{property.name}</p>
                              )}
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                              {binSummaries.map((bin) => (
                                <div
                                  key={bin.key}
                                  className={clsx(
                                    'flex h-full min-h-[72px] min-w-0 flex-col justify-center gap-2 rounded-2xl border px-3 py-2 text-xs transition-colors sm:px-4 sm:py-3 sm:text-sm',
                                    BIN_THEME[bin.key].panel,
                                  )}
                                >
                                  <p className="whitespace-nowrap text-sm font-semibold leading-tight text-white sm:text-base">
                                    {bin.count} {bin.label} {bin.count === 1 ? 'Bin' : 'Bins'}
                                  </p>
                                  <p className="flex items-center gap-1 text-xs text-white/70 sm:text-sm">
                                    {bin.frequency.showCalendarIcon && (
                                      <CalendarDaysIcon className="h-4 w-4 text-white/70" aria-hidden />
                                    )}
                                    <span>{bin.frequency.label}</span>
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 text-sm text-white/60">
                            <p className="text-xs text-white/50">
                              Put out: {property.putOutDay ?? '—'} · Collection: {property.collectionDay ?? '—'}
                            </p>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p>
                                Next service:
                                <span className="ml-2 font-medium text-white">
                                  {property.nextServiceAt
                                    ? format(new Date(property.nextServiceAt), 'EEE, MMM d')
                                    : 'Awaiting schedule'}
                                </span>
                              </p>
                              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition group-hover:text-white">
                                View job history <span aria-hidden>→</span>
                              </span>
                            </div>
                          </div>
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
