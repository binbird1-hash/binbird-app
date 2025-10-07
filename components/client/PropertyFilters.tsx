'use client'

import { useEffect, useId, useMemo, useState } from 'react'
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

export function PropertyFilters({ filters, onChange, properties }: PropertyFiltersProps) {
  const searchSuggestions = useMemo(() => {
    const suggestions = new Set<string>()
    properties.forEach((property) => {
      const addressLine = property.addressLine?.trim().toLowerCase()
      const name = property.name?.trim()
      if (name && name.toLowerCase() !== addressLine) {
        suggestions.add(name)
      }
      const address = formatAddress(property)
      if (address) {
        suggestions.add(address)
      }
    })
    return Array.from(suggestions).sort((a, b) => a.localeCompare(b))
  }, [properties])

  const searchInputId = useId()
  const [showSuggestions, setShowSuggestions] = useState(false)
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

  useEffect(() => {
    if (!filters.search.trim()) {
      setShowSuggestions(false)
    }
  }, [filters.search])

  return (
    <div className="w-full">
      <div className="relative">
        <input
          id={searchInputId}
          type="search"
          autoComplete="off"
          placeholder="Search for property address"
          value={filters.search}
          onChange={(event) => {
            const value = event.target.value
            update({ search: value })
            setShowSuggestions(value.trim().length > 0)
          }}
          onFocus={() => {
            if (filters.search.trim().length > 0) {
              setShowSuggestions(true)
            }
          }}
          onBlur={() => {
            setShowSuggestions(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              setShowSuggestions(false)
            }
          }}
          className="h-11 w-full rounded-2xl border border-white bg-black/40 px-4 text-sm text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
        />
        {showSuggestions && matchingSuggestions.length > 0 && (
          <ul className="absolute left-0 right-0 z-10 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-white bg-black/80 p-2 backdrop-blur">
            {matchingSuggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    update({ search: suggestion })
                    setShowSuggestions(false)
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
  )
}
