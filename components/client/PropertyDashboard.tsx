'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { MapPinIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import type { Property } from './ClientPortalProvider'
import { PropertyFilters, type PropertyFilterState } from './PropertyFilters'

const DEFAULT_FILTERS: PropertyFilterState = {
  search: '',
  status: 'all',
  binType: 'all',
  groupBy: 'city',
}

function matchesFilters(property: Property, filters: PropertyFilterState) {
  if (filters.status !== 'all' && property.status !== filters.status) return false
  if (filters.search) {
    const term = filters.search.toLowerCase()
    if (!property.name.toLowerCase().includes(term) && !property.suburb.toLowerCase().includes(term)) {
      return false
    }
  }
  if (filters.binType !== 'all') {
    const hasBinType = property.binTypes.some((bin) => {
      const normalised = bin.toLowerCase()
      if (filters.binType === 'landfill') return normalised.includes('red') || normalised.includes('landfill')
      if (filters.binType === 'recycling') return normalised.includes('yellow') || normalised.includes('recycle')
      return normalised.includes('green') || normalised.includes('organic')
    })
    if (!hasBinType) return false
  }
  return true
}

function groupProperties(properties: Property[], filters: PropertyFilterState) {
  if (filters.groupBy === 'status') {
    return properties.reduce<Record<string, Property[]>>((groups, property) => {
      const key = property.status
      groups[key] = groups[key] ? [...groups[key], property] : [property]
      return groups
    }, {})
  }

  return properties.reduce<Record<string, Property[]>>((groups, property) => {
    const key = property.city || 'Unassigned'
    groups[key] = groups[key] ? [...groups[key], property] : [property]
    return groups
  }, {})
}

export type PropertyDashboardProps = {
  properties: Property[]
  isLoading: boolean
}

export function PropertyDashboard({ properties, isLoading }: PropertyDashboardProps) {
  const [filters, setFilters] = useState<PropertyFilterState>(DEFAULT_FILTERS)

  const filtered = useMemo(() => properties.filter((property) => matchesFilters(property, filters)), [properties, filters])
  const grouped = useMemo(() => groupProperties(filtered, filters), [filtered, filters])

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
          {Object.entries(grouped).map(([groupName, groupProperties]) => (
            <section key={groupName} className="space-y-4">
              <header className="flex items-center justify-between text-sm text-white/60">
                <div>
                  <h3 className="text-lg font-semibold text-white">{groupName}</h3>
                  <p>{groupProperties.length} properties</p>
                </div>
              </header>
              <div className="grid gap-4 md:grid-cols-2">
                {groupProperties.map((property) => (
                  <article
                    key={property.id}
                    className="group flex flex-col rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:border-binbird-red hover:bg-binbird-red/10"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-xl font-semibold text-white">{property.name}</h4>
                        <p className="mt-1 flex items-center gap-2 text-sm text-white/60">
                          <MapPinIcon className="h-4 w-4" />
                          {property.addressLine}, {property.suburb}
                        </p>
                      </div>
                      <span
                        className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-wide text-white/70"
                        aria-label={`Status: ${property.status}`}
                      >
                        {property.status === 'active' ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {property.binTypes.map((bin) => (
                        <span
                          key={bin}
                          className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white/70"
                        >
                          {bin}
                        </span>
                      ))}
                    </div>
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-sm text-white/60">
                      <p>
                        Next service:
                        <span className="ml-2 font-medium text-white">
                          {property.nextServiceAt ? format(new Date(property.nextServiceAt), 'EEE, MMM d') : 'Awaiting schedule'}
                        </span>
                      </p>
                      {property.latitude && property.longitude ? (
                        <a
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white/70 transition hover:border-binbird-red hover:text-white"
                          href={`https://www.google.com/maps/search/?api=1&query=${property.latitude},${property.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open map
                          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="text-xs text-white/40">Location pending</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
