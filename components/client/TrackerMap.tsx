'use client'

import { useMemo } from 'react'
import type { Job, Property } from './ClientPortalProvider'
import { computeEtaLabel } from './ClientPortalProvider'

function normaliseCoordinate(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return 0.5
  return (value - min) / (max - min || 1)
}

export type TrackerMapProps = {
  jobs: Job[]
  properties: Property[]
}

export function TrackerMap({ jobs, properties }: TrackerMapProps) {
  const markers = useMemo(() => {
    const points = jobs
      .map((job) => {
        const property = properties.find((candidate) => candidate.id === job.propertyId)
        const lat = job.lastLatitude ?? property?.latitude ?? null
        const lng = job.lastLongitude ?? property?.longitude ?? null
        if (lat === null || lng === null) return null
        return { lat, lng, job, property }
      })
      .filter(Boolean) as { lat: number; lng: number; job: Job; property?: Property }[]

    if (points.length === 0) return []

    const minLat = Math.min(...points.map((point) => point.lat))
    const maxLat = Math.max(...points.map((point) => point.lat))
    const minLng = Math.min(...points.map((point) => point.lng))
    const maxLng = Math.max(...points.map((point) => point.lng))

    return points.map((point) => ({
      top: `${(1 - normaliseCoordinate(point.lat, minLat, maxLat)) * 90 + 5}%`,
      left: `${normaliseCoordinate(point.lng, minLng, maxLng) * 90 + 5}%`,
      job: point.job,
      property: point.property,
    }))
  }, [jobs, properties])

  return (
    <div className="relative h-80 overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top,#2a2a2a,transparent)]">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(239,68,68,0.2),rgba(0,0,0,0.6))]" />
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\' viewBox=\'0 0 200 200\'%3E%3Cpath d=\'M0 50 L200 50 M0 150 L200 150 M50 0 L50 200 M150 0 L150 200\' stroke=\'rgba(255,255,255,0.08)\' stroke-width=\'2\'/%3E%3C/svg%3E")' }} />
      {markers.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">
          Location data will appear here once your crew heads out.
        </div>
      ) : (
        markers.map((marker) => (
          <div
            key={marker.job.id}
            className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center gap-2"
            style={{ top: marker.top, left: marker.left }}
          >
            <span className="rounded-full border border-white/40 bg-binbird-red px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-lg shadow-red-900/40">
              {computeEtaLabel(marker.job)}
            </span>
            <div className="rounded-2xl border border-white/20 bg-black/80 px-4 py-2 text-center text-xs text-white/80">
              <p className="font-semibold text-white">{marker.property?.name ?? marker.job.propertyName}</p>
              <p>{marker.job.status.replace('_', ' ')}</p>
            </div>
            <span className="h-3 w-3 rounded-full border-2 border-white bg-binbird-red" />
          </div>
        ))
      )}
    </div>
  )
}
