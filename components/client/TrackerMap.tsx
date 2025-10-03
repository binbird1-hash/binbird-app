'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { GoogleMap, MarkerF, OverlayViewF, useLoadScript } from '@react-google-maps/api'
import type { Property } from './ClientPortalProvider'
import { useMapSettings } from '@/components/Context/MapSettingsContext'
import { darkMapStyle, lightMapStyle, satelliteMapStyle } from '@/lib/mapStyle'

function normalisePropertyCoordinate(value: number | null | undefined): number | null {
  if (typeof value !== 'number') return null
  return Number.isFinite(value) ? value : null
}

type PropertyMarkerDescriptor = {
  property: Property
  position: google.maps.LatLngLiteral
}

export type TrackerMapProps = {
  properties: Property[]
}

const FALLBACK_CENTER: google.maps.LatLngLiteral = { lat: -33.865143, lng: 151.2099 }

const MAP_STYLE_LOOKUP = {
  Dark: darkMapStyle,
  Light: lightMapStyle,
  Satellite: satelliteMapStyle,
} as const

function formatPropertyAddress(property: Property) {
  const parts = [property.addressLine, property.suburb, property.city].filter(Boolean)
  return parts.join(', ')
}

export function TrackerMap({ properties }: TrackerMapProps) {
  const { mapStylePref } = useMapSettings()
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const { isLoaded, loadError } = useLoadScript({
    id: 'client-tracker-map',
    googleMapsApiKey: apiKey ?? '',
  })
  const [map, setMap] = useState<google.maps.Map | null>(null)

  const propertyMarkers = useMemo<PropertyMarkerDescriptor[]>(() => {
    return properties
      .map((property) => {
        const latitude = normalisePropertyCoordinate(property.latitude)
        const longitude = normalisePropertyCoordinate(property.longitude)

        if (latitude === null || longitude === null) return null

        return {
          property,
          position: { lat: latitude, lng: longitude },
        }
      })
      .filter((marker): marker is PropertyMarkerDescriptor => Boolean(marker))
  }, [properties])

  const mapCenter = useMemo(() => {
    if (propertyMarkers.length === 0) return FALLBACK_CENTER
    const aggregate = propertyMarkers.reduce(
      (acc, point) => ({ lat: acc.lat + point.position.lat, lng: acc.lng + point.position.lng }),
      { lat: 0, lng: 0 },
    )
    return {
      lat: aggregate.lat / propertyMarkers.length,
      lng: aggregate.lng / propertyMarkers.length,
    }
  }, [propertyMarkers])

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

    if (propertyMarkers.length === 0) {
      map.setCenter(FALLBACK_CENTER)
      map.setZoom(11)
      return
    }

    if (typeof window === 'undefined' || !window.google?.maps) return

    if (propertyMarkers.length === 1) {
      map.panTo(propertyMarkers[0]!.position)
      map.setZoom(14)
      return
    }

    const bounds = new window.google.maps.LatLngBounds()
    propertyMarkers.forEach((marker) => bounds.extend(marker.position))
    map.fitBounds(bounds, 48)
  }, [map, propertyMarkers])

  const propertyIcon = useMemo(() => {
    if (!isLoaded || typeof window === 'undefined' || !window.google?.maps) return undefined
    const svg = `
      <svg width="48" height="56" viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="pinGradient" x1="24" y1="4" x2="24" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#fb7185" />
            <stop offset="100%" stop-color="#ef4444" />
          </linearGradient>
        </defs>
        <path d="M24 4C15.163 4 8 11.163 8 20c0 10.5 12.5 24 15.2 27.2a1.2 1.2 0 0 0 1.6 0C27.5 44 40 30.5 40 20 40 11.163 32.837 4 24 4Z" fill="url(#pinGradient)" stroke="white" stroke-width="2" />
        <circle cx="24" cy="20" r="7" fill="white" fill-opacity="0.9" />
      </svg>
    `
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new window.google.maps.Size(44, 54),
      anchor: new window.google.maps.Point(22, 50),
    }
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
          Add a Google Maps API key to view your properties on the map.
        </div>
      ) : loadError ? (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/60">
          We couldn’t load the map right now. Please refresh to try again.
        </div>
      ) : !isLoaded ? (
        <div className="absolute inset-0 flex items-center justify-center text-white/60">Loading map…</div>
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
            {propertyMarkers.map((marker) => (
              <MarkerF
                key={`property-${marker.property.id}`}
                position={marker.position}
                icon={propertyIcon}
                title={marker.property.name}
                zIndex={1}
              />
            ))}
            {propertyMarkers.map((marker) => (
              <OverlayViewF
                key={`overlay-${marker.property.id}`}
                position={marker.position}
                mapPaneName="overlayMouseTarget"
              >
                <div className="pointer-events-none -translate-x-1/2 -translate-y-5">
                  <div className="flex flex-col items-center gap-1">
                    <div className="rounded-2xl border border-white/20 bg-black/80 px-3 py-2 text-xs text-white/80 shadow-lg shadow-black/40">
                      <p className="text-sm font-semibold text-white">{marker.property.name}</p>
                      <p className="text-[11px] text-white/70">{formatPropertyAddress(marker.property)}</p>
                    </div>
                    <div className="h-2 w-3 rotate-180 text-white">
                      <svg viewBox="0 0 12 8" className="h-full w-full text-black/70" fill="none">
                        <path d="M6 8 0 0h12L6 8Z" fill="currentColor" />
                      </svg>
                    </div>
                  </div>
                </div>
              </OverlayViewF>
            ))}
          </GoogleMap>
          {propertyMarkers.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/60">
              Add latitude and longitude to your properties to see them appear on the map.
            </div>
          )}
        </>
      )}
    </div>
  )
}
