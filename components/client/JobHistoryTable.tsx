'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { DocumentArrowDownIcon, PhotoIcon } from '@heroicons/react/24/outline'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import { useClientPortal, type Job, type Property } from './ClientPortalProvider'
import { ProofGalleryModal } from './ProofGalleryModal'

export type JobHistoryTableProps = {
  jobs: Job[]
  properties: Property[]
}

type HistoryFilters = {
  status: 'all' | Job['status']
  propertyId: 'all' | string
  search: string
}

const DEFAULT_FILTERS: HistoryFilters = {
  status: 'all',
  propertyId: 'all',
  search: '',
}

const STATUS_LABELS: Record<Job['status'], string> = {
  scheduled: 'Scheduled',
  en_route: 'En route',
  on_site: 'On site',
  completed: 'Completed',
  skipped: 'Skipped',
}

function toCsv(jobs: Job[]) {
  const header = 'Job ID,Property,Status,Completed\n'
  const rows = jobs
    .map((job) =>
      [
        job.id,
        job.propertyName,
        job.status,
        job.completedAt ? format(new Date(job.completedAt), 'yyyy-MM-dd HH:mm') : '',
      ]
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n')
  return header + rows
}

function downloadCsv(jobs: Job[]) {
  const blob = new Blob([toCsv(jobs)], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, `binbird-job-history-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`)
}

function downloadPdf(jobs: Job[]) {
  const doc = new jsPDF({ orientation: 'landscape' })
  doc.setFontSize(14)
  doc.text('BinBird job history', 14, 18)
  doc.setFontSize(10)
  const columnTitles = ['Property', 'Status', 'Completed']
  const startY = 28
  columnTitles.forEach((title, index) => {
    doc.text(title, 14 + index * 80, startY)
  })
  let y = startY + 6
  jobs.slice(0, 30).forEach((job) => {
    const row = [
      job.propertyName,
      STATUS_LABELS[job.status],
      job.completedAt ? format(new Date(job.completedAt), 'PP p') : '',
    ]
    row.forEach((cell, index) => {
      doc.text(String(cell), 14 + index * 80, y)
    })
    y += 6
    if (y > 190) {
      doc.addPage()
      y = 20
    }
  })
  doc.save(`binbird-job-history-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`)
}

export function JobHistoryTable({ jobs, properties }: JobHistoryTableProps) {
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS)
  const [proofJob, setProofJob] = useState<Job | null>(null)
  const { selectedAccount } = useClientPortal()

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
      if (filters.status !== 'all' && job.status !== filters.status) return false
      if (filters.search) {
        return (
          job.propertyName.toLowerCase().includes(lowerSearch) ||
          job.notes?.toLowerCase().includes(lowerSearch) ||
          job.id.toLowerCase().includes(lowerSearch)
        )
      }
      return true
    })
  }, [jobs, filters])

  const handleDownloadCsv = () => downloadCsv(filteredJobs)
  const handleDownloadPdf = () => downloadPdf(filteredJobs)

  return (
    <div className="space-y-6 text-white">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-white/60">Property</span>
            <select
              value={filters.propertyId}
              onChange={(event) => setFilters((current) => ({ ...current, propertyId: event.target.value }))}
              className="min-w-[200px] rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            >
              <option value="all">All properties</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
              {jobs
                .filter((job) => !job.propertyId)
                .map((job) => (
                  <option key={`job-${job.id}`} value={`job-${job.id}`}>
                    {job.propertyName}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-white/60">Status</span>
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as HistoryFilters['status'] }))}
              className="min-w-[160px] rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            >
              <option value="all">All statuses</option>
              {(Object.keys(STATUS_LABELS) as Job['status'][]).map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-white/60">Search</span>
            <input
              type="search"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search by property or note"
              className="min-w-[220px] rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-binbird-red"
          >
            <DocumentArrowDownIcon className="h-5 w-5" /> Export CSV
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-binbird-red"
          >
            <DocumentArrowDownIcon className="h-5 w-5" /> Export PDF
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10 text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-white/40">
            <tr>
              <th scope="col" className="px-4 py-3">
                Property
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Completed
              </th>
              <th scope="col" className="px-4 py-3">
                Notes
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Proof
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
                  <td className="px-4 py-3 text-white">
                    <div className="font-semibold">{job.propertyName}</div>
                    <p className="mt-1 text-xs text-white/50">
                      {job.jobType ? job.jobType.replace('_', ' ') : 'service'}
                      {job.bins && job.bins.length > 0 ? ` · ${job.bins.join(', ')}` : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-white/70">{STATUS_LABELS[job.status]}</td>
                  <td className="px-4 py-3 text-white/70">
                    {job.completedAt ? format(new Date(job.completedAt), 'PP p') : '—'}
                  </td>
                  <td className="px-4 py-3 text-white/60">{job.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
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
