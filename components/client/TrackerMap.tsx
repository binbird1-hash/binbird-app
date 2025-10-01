'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { GoogleMap, MarkerF, OverlayViewF, useLoadScript } from '@react-google-maps/api'
import type { Job, Property } from './ClientPortalProvider'
import { computeEtaLabel } from './ClientPortalProvider'
import { useMapSettings } from '@/components/Context/MapSettingsContext'
import { darkMapStyle, lightMapStyle, satelliteMapStyle } from '@/lib/mapStyle'

function normalisePropertyCoordinate(value: number | null | undefined): number | null {
  if (typeof value !== 'number') return null
  return Number.isFinite(value) ? value : null
}

type MarkerDescriptor = {
  job: Job
  property?: Property
  position: google.maps.LatLngLiteral
}

type PropertyMarkerDescriptor = {
  property: Property
  position: google.maps.LatLngLiteral
}

export type TrackerMapProps = {
  jobs: Job[]
  properties: Property[]
}

const FALLBACK_CENTER: google.maps.LatLngLiteral = { lat: -33.865143, lng: 151.2099 }

const STATUS_COLOURS: Record<Job['status'], string> = {
  scheduled: '#f59e0b',
  en_route: '#3b82f6',
  on_site: '#ef4444',
  completed: '#22c55e',
  skipped: '#9ca3af',
}

const MAP_STYLE_LOOKUP = {
  Dark: darkMapStyle,
  Light: lightMapStyle,
  Satellite: satelliteMapStyle,
} as const

export function TrackerMap({ jobs, properties }: TrackerMapProps) {
  const { mapStylePref } = useMapSettings()
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const { isLoaded, loadError } = useLoadScript({
    id: 'client-tracker-map',
    googleMapsApiKey: apiKey ?? '',
  })
  const [map, setMap] = useState<google.maps.Map | null>(null)

  const jobMarkers = useMemo<MarkerDescriptor[]>(() => {
    const propertyById = new Map(properties.map((property) => [property.id, property]))
    const markers: MarkerDescriptor[] = []

    for (const job of jobs) {
      const property = job.propertyId ? propertyById.get(job.propertyId) : undefined
      const latitude = normalisePropertyCoordinate(job.lastLatitude ?? property?.latitude)
      const longitude = normalisePropertyCoordinate(job.lastLongitude ?? property?.longitude)

      if (latitude === null || longitude === null) continue

      markers.push({
        job,
        property,
        position: { lat: latitude, lng: longitude },
      })
    }

    return markers
  }, [jobs, properties])

  const jobPropertyIds = useMemo(() => {
    const ids = new Set<string>()
    jobMarkers.forEach((marker) => {
      if (marker.property?.id) {
        ids.add(marker.property.id)
      }
    })
    return ids
  }, [jobMarkers])

  const idlePropertyMarkers = useMemo<PropertyMarkerDescriptor[]>(() => {
    return properties
      .filter((property) => {
        if (!property.id || jobPropertyIds.has(property.id)) return false
        const latitude = normalisePropertyCoordinate(property.latitude)
        const longitude = normalisePropertyCoordinate(property.longitude)
        return latitude !== null && longitude !== null
      })
      .map((property) => ({
        property,
        position: {
          lat: normalisePropertyCoordinate(property.latitude) as number,
          lng: normalisePropertyCoordinate(property.longitude) as number,
        },
      }))
  }, [jobPropertyIds, properties])

  const anchorPoints = useMemo(() => {
    if (jobMarkers.length > 0) return jobMarkers.map((marker) => marker.position)
    if (idlePropertyMarkers.length > 0) return idlePropertyMarkers.map((marker) => marker.position)
    return []
  }, [idlePropertyMarkers, jobMarkers])

  const mapCenter = useMemo(() => {
    if (anchorPoints.length === 0) return FALLBACK_CENTER
    const aggregate = anchorPoints.reduce(
      (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
      { lat: 0, lng: 0 },
    )
    return {
      lat: aggregate.lat / anchorPoints.length,
      lng: aggregate.lng / anchorPoints.length,
    }
  }, [anchorPoints])

  const mapOptions = useMemo(
    () => ({
      styles: MAP_STYLE_LOOKUP[mapStylePref] ?? darkMapStyle,
      disableDefaultUI: true,
      zoomControl: true,
      fullscreenControl: false,
      streetViewControl: false,
      gestureHandling: 'greedy',
      backgroundColor: '#000000',
    }),
    [mapStylePref],
  )

  useEffect(() => {
    if (!map) return

    if (anchorPoints.length === 0) {
      map.setCenter(FALLBACK_CENTER)
      map.setZoom(11)
      return
    }

    if (typeof window === 'undefined' || !window.google?.maps) return

    if (anchorPoints.length === 1) {
      map.panTo(anchorPoints[0]!)
      map.setZoom(14)
      return
    }

    const bounds = new window.google.maps.LatLngBounds()
    anchorPoints.forEach((point) => bounds.extend(point))
    map.fitBounds(bounds, 48)
  }, [anchorPoints, map])

  const statusIcons = useMemo(() => {
    if (!isLoaded || typeof window === 'undefined' || !window.google?.maps) return null
    const entries = Object.entries(STATUS_COLOURS).map(
      ([status, colour]) =>
        [
          status as Job['status'],
          {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: colour,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          } as google.maps.Symbol,
        ] as const,
    )
    return new Map<Job['status'], google.maps.Symbol>(entries)
  }, [isLoaded])

  const propertyIcon = useMemo(() => {
    if (!isLoaded || typeof window === 'undefined' || !window.google?.maps) return undefined
    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: '#6b7280',
      fillOpacity: 0.9,
      strokeColor: '#111827',
      strokeWeight: 2,
    } as google.maps.Symbol
  }, [isLoaded])

  const handleMapLoad = useCallback((instance: google.maps.Map) => {
    setMap(instance)
  }, [])

  const handleMapUnmount = useCallback(() => {
    setMap(null)
  }, [])

  return (
    <div className="relative h-80 overflow-hidden rounded-3xl border border-white/10 bg-black/60">
      {!apiKey ? (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/60">
          Add a Google Maps API key to enable live location tracking.
        </div>
      ) : loadError ? (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/60">
          We couldn’t load the map right now. Please refresh to try again.
        </div>
      ) : !isLoaded ? (
        <div className="absolute inset-0 flex items-center justify-center text-white/60">Loading live map…</div>
      ) : (
        <>
          <GoogleMap
            mapContainerClassName="h-full w-full"
            options={mapOptions}
            center={mapCenter}
            zoom={12}
            onLoad={handleMapLoad}
            onUnmount={handleMapUnmount}
          >
            {jobMarkers.map((marker) => (
              <MarkerF
                key={`job-${marker.job.id}`}
                position={marker.position}
                icon={statusIcons?.get(marker.job.status)}
                title={marker.property?.name ?? marker.job.propertyName}
                zIndex={marker.job.status === 'completed' ? 2 : 3}
              />
            ))}
            {jobMarkers.map((marker) => (
              <OverlayViewF
                key={`overlay-${marker.job.id}`}
                position={marker.position}
                mapPaneName="overlayMouseTarget"
              >
                <div className="pointer-events-none -translate-x-1/2 -translate-y-3">
                  <div className="rounded-2xl border border-white/20 bg-black/80 px-3 py-2 text-xs text-white/80 shadow-lg shadow-black/40">
                    <p className="text-sm font-semibold text-white">
                      {marker.property?.name ?? marker.job.propertyName}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-white/50">
                      {marker.job.status.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-white/70">{computeEtaLabel(marker.job)}</p>
                  </div>
                </div>
              </OverlayViewF>
            ))}
            {idlePropertyMarkers.map((marker) => (
              <MarkerF
                key={`property-${marker.property.id}`}
                position={marker.position}
                icon={propertyIcon}
                title={marker.property.name}
                zIndex={1}
              />
            ))}
          </GoogleMap>
          {jobMarkers.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/60">
              Location data will appear here once your crew heads out.
            </div>
          )}
        </>
      )}
    </div>
  )
}
