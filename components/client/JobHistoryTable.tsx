'use client'

import { Fragment, useEffect, useId, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  CheckIcon,
  ChevronUpDownIcon,
  DocumentArrowDownIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { saveAs } from 'file-saver'
import { Listbox, Transition } from '@headlessui/react'
import clsx from 'clsx'
import { useClientPortal, type Job, type Property } from './ClientPortalProvider'
import { ProofGalleryModal } from './ProofGalleryModal'

export type JobHistoryTableProps = {
  jobs: Job[]
  properties: Property[]
  initialPropertyId?: string | null
}

type HistoryFilters = {
  propertyId: 'all' | string
  search: string
}

type HistorySelectOption = {
  value: string
  label: string
}

const DEFAULT_FILTERS: HistoryFilters = {
  propertyId: 'all',
  search: '',
}

const formatJobTypeLabel = (value: string | null | undefined) => {
  if (!value) return 'Service'
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const formatAddress = (property: Property | undefined) => {
  if (!property) return null
  const parts: string[] = []
  const register = (value: string | null | undefined) => {
    if (!value) return
    const trimmed = value.trim()
    if (!trimmed.length) return
    parts.push(trimmed)
  }

  register(property.addressLine)
  register(property.suburb)

  const suburb = property.suburb?.trim().toLowerCase()
  const city = property.city?.trim()
  if (city && city.length > 0) {
    const normalizedCity = city.toLowerCase()
    if (!suburb || normalizedCity !== suburb) {
      register(property.city)
    }
  }

  if (parts.length === 0) return null

  const seen = new Set<string>()
  const uniqueParts = parts.filter((part) => {
    const normalized = part.toLowerCase()
    if (seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })

  return uniqueParts.join(', ')
}

const escapeForCsv = (value: string) => `"${value.replace(/"/g, '""')}"`

const isRedundantLabel = (label: string, property: Property | undefined, fullAddress: string | null) => {
  const normalizedLabel = label.trim().toLowerCase()
  if (!normalizedLabel) return true

  const normalizedAddressLine = property?.addressLine?.trim().toLowerCase()
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

export function JobHistoryTable({ jobs, properties, initialPropertyId }: JobHistoryTableProps) {
  const [filters, setFilters] = useState<HistoryFilters>(() => ({
    ...DEFAULT_FILTERS,
    propertyId: initialPropertyId && initialPropertyId.length > 0 ? initialPropertyId : DEFAULT_FILTERS.propertyId,
  }))
  const [proofJob, setProofJob] = useState<Job | null>(null)
  const { selectedAccount } = useClientPortal()
  const searchInputId = useId()

  useEffect(() => {
    setFilters((current) => {
      const nextPropertyId = initialPropertyId && initialPropertyId.length > 0 ? initialPropertyId : 'all'
      if (current.propertyId === nextPropertyId) {
        return current
      }
      return { ...current, propertyId: nextPropertyId }
    })
  }, [initialPropertyId])

  const propertyMap = useMemo(() => {
    const map = new Map<string, Property>()
    properties.forEach((property) => {
      map.set(property.id, property)
    })
    return map
  }, [properties])

  const propertyOptions = useMemo<HistorySelectOption[]>(() => {
    const baseOptions: HistorySelectOption[] = [
      { value: 'all', label: 'All properties' },
      ...properties.map((property) => ({ value: property.id, label: property.name })),
    ]

    const unassignedJobs = jobs
      .filter((job) => !job.propertyId)
      .map((job) => ({ value: `job-${job.id}`, label: job.propertyName }))

    return [...baseOptions, ...unassignedJobs]
  }, [jobs, properties])

  const searchSuggestions = useMemo(() => {
    const suggestions = new Set<string>()

    properties.forEach((property) => {
      const fullAddress = formatAddress(property)
      if (fullAddress) {
        suggestions.add(fullAddress)
      }

      const name = property.name?.trim()
      if (name && !isRedundantLabel(name, property, fullAddress)) {
        suggestions.add(name)
      }
    })

    jobs.forEach((job) => {
      const property = job.propertyId ? propertyMap.get(job.propertyId) : undefined
      const fullAddress = property ? formatAddress(property) : null
      if (fullAddress) {
        suggestions.add(fullAddress)
      }

      const propertyName = job.propertyName?.trim()
      if (propertyName) {
        if (!property || !isRedundantLabel(propertyName, property, fullAddress)) {
          suggestions.add(propertyName)
        }
      }
    })

    return Array.from(suggestions).sort((a, b) => a.localeCompare(b))
  }, [jobs, properties, propertyMap])

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

  const filteredJobs = useMemo(() => {
    const lowerSearch = filters.search.toLowerCase()
    return jobs.filter((job) => {
      if (filters.propertyId !== 'all') {
        if (filters.propertyId.startsWith('job-')) {
          const targetId = filters.propertyId.slice(4)
          if (job.id !== targetId) return false
        } else if (job.propertyId !== filters.propertyId) {
          return false
        }
      }
      if (filters.search) {
        const property = job.propertyId ? propertyMap.get(job.propertyId) : undefined
        const fullAddress = formatAddress(property)
        const jobTypeLabel = formatJobTypeLabel(job.jobType)
        return (
          job.propertyName.toLowerCase().includes(lowerSearch) ||
          (fullAddress ? fullAddress.toLowerCase().includes(lowerSearch) : false) ||
          jobTypeLabel.toLowerCase().includes(lowerSearch) ||
          job.notes?.toLowerCase().includes(lowerSearch) ||
          job.id.toLowerCase().includes(lowerSearch)
        )
      }
      return true
    })
  }, [filters.propertyId, filters.search, jobs, propertyMap])

  const handleDownloadCsv = () => {
    const header = ['Address', 'Job', 'Completed', 'Notes']
    const rows = filteredJobs.map((job) => {
      const property = job.propertyId ? propertyMap.get(job.propertyId) : undefined
      const fullAddress = formatAddress(property) ?? job.propertyName ?? 'Property'
      const jobTypeLabel = formatJobTypeLabel(job.jobType)
      const bins = job.bins && job.bins.length > 0 ? job.bins.join(', ') : ''
      const jobDescription = bins ? `${jobTypeLabel} · ${bins}` : jobTypeLabel
      const completed = job.completedAt ? format(new Date(job.completedAt), 'yyyy-MM-dd HH:mm') : ''
      const notes = job.notes ?? ''
      return [fullAddress, jobDescription, completed, notes].map((value) =>
        escapeForCsv(String(value ?? '')),
      )
    })
    const csvContent = [header.map(escapeForCsv).join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, `binbird-job-history-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`)
  }

  return (
    <div className="space-y-6 text-white">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <HistorySelect
            label="Property"
            value={filters.propertyId}
            onChange={(value) => setFilters((current) => ({ ...current, propertyId: value }))}
            options={propertyOptions}
            className="w-full md:min-w-[200px]"
          />
          <div className="flex w-full max-w-2xl flex-col gap-2 text-sm">
            <label className="text-white/60" htmlFor={searchInputId}>
              Search
            </label>
            <div className="relative">
              <input
                id={searchInputId}
                type="search"
                autoComplete="off"
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, search: event.target.value }))
                }
                placeholder="Search by property, address, or notes"
                className="w-full appearance-none rounded-2xl border border-white/10 bg-black/40 px-4 py-2 pr-12 text-sm text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
              />
              {filters.search ? (
                <button
                  type="button"
                  onClick={() =>
                    setFilters((current) => ({ ...current, search: '' }))
                  }
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
                          setFilters((current) => ({ ...current, search: suggestion }))
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
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-binbird-red md:w-auto"
          >
            <DocumentArrowDownIcon className="h-5 w-5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="relative overflow-x-auto rounded-3xl border border-white/10 bg-black/20">
        <table className="min-w-[760px] w-full table-auto divide-y divide-white/10 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-white/40">
            <tr>
              <th scope="col" className="px-4 py-3">
                Address
              </th>
              <th scope="col" className="px-4 py-3">
                Job
              </th>
              <th scope="col" className="px-4 py-3">
                Completed
              </th>
              <th scope="col" className="px-4 py-3">
                Notes
              </th>
              <th scope="col" className="px-4 py-3 text-center">
                Photo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredJobs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-white/60">
                  No jobs found for the selected filters.
                </td>
              </tr>
            ) : (
              filteredJobs.map((job) => (
                <tr key={job.id} className="hover:bg-white/5">
                  <td className="min-w-[220px] px-4 py-4 align-middle text-white">
                    {(() => {
                      const property = job.propertyId ? propertyMap.get(job.propertyId) : undefined
                      const propertyName = property?.name ?? job.propertyName
                      const fullAddress = formatAddress(property) ?? job.propertyName
                      return (
                        <>
                          <div className="font-semibold truncate">{propertyName}</div>
                          {fullAddress && (
                            <p
                              className="mt-1 max-w-xs text-xs text-white/60"
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: '2',
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {fullAddress}
                            </p>
                          )}
                        </>
                      )
                    })()}
                  </td>
                  <td className="px-4 py-4 align-middle text-white">
                    <div className="font-semibold">{formatJobTypeLabel(job.jobType)}</div>
                    <p className="mt-1 text-xs text-white/60">
                      {job.bins && job.bins.length > 0 ? job.bins.join(', ') : 'No bins recorded'}
                    </p>
                  </td>
                  <td className="px-4 py-4 align-middle text-white/70">
                    {(() => {
                      const proofUploadedAt = job.proofUploadedAt
                        ? new Date(job.proofUploadedAt)
                        : job.completedAt
                          ? new Date(job.completedAt)
                          : null
                      return proofUploadedAt ? format(proofUploadedAt, 'PP p') : '—'
                    })()}
                  </td>
                  <td className="px-4 py-4 align-middle text-white/60">{job.notes ?? '—'}</td>
                  <td className="px-4 py-4 align-middle text-center">
                    <button
                      type="button"
                      onClick={() => setProofJob(job)}
                      disabled={!job.proofPhotoKeys || job.proofPhotoKeys.length === 0}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white transition hover:border-binbird-red disabled:cursor-not-allowed disabled:border-white/5 disabled:text-white/30"
                    >
                      <PhotoIcon className="h-4 w-4" /> View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-white/40 sm:hidden">Swipe horizontally to view more job details.</p>

      <ProofGalleryModal
        isOpen={Boolean(proofJob)}
        onClose={() => setProofJob(null)}
        photoKeys={proofJob?.proofPhotoKeys ?? []}
      />

      <p className="text-xs text-white/40">
        Showing jobs for account <strong className="text-white">{selectedAccount?.name}</strong> from the last 60 days.
      </p>
    </div>
  )
}

type HistorySelectProps = {
  label: string
  value: string
  onChange: (value: string) => void
  options: HistorySelectOption[]
  className?: string
}

function HistorySelect({ label, value, onChange, options, className }: HistorySelectProps) {
  const selectedOption = options.find((option) => option.value === value) ?? options[0]

  return (
    <div className={clsx('flex flex-col gap-1 text-sm', className)}>
      <span className="text-white/60">{label}</span>
      <Listbox value={value} onChange={onChange}>
        {({ open }) => (
          <div className="relative">
            <Listbox.Button className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-left text-sm text-white shadow-lg shadow-black/20 transition focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30">
              <span className="block truncate text-white/90">{selectedOption?.label}</span>
              <ChevronUpDownIcon className="h-4 w-4 text-white/60" aria-hidden="true" />
            </Listbox.Button>
            <Transition
              as={Fragment}
              show={open}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Listbox.Options className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/90 p-1 text-sm text-white shadow-xl backdrop-blur">
                {options.map((option) => (
                  <Listbox.Option
                    key={option.value}
                    value={option.value}
                    className={({ active }) =>
                      clsx(
                        'flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-white/70 transition',
                        active && 'bg-binbird-red/20 text-white',
                      )
                    }
                  >
                    {({ selected }) => (
                      <>
                        <span className="block truncate">{option.label}</span>
                        {selected && <CheckIcon className="h-4 w-4 text-binbird-red" aria-hidden="true" />}
                      </>
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </Transition>
          </div>
        )}
      </Listbox>
    </div>
  )
}
