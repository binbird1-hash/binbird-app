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
    const svg = encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?>
      <svg width="52" height="70" viewBox="0 0 52 70" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="pinGradient" x1="26" y1="0" x2="26" y2="70" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#facc15"/>
            <stop offset="45%" stop-color="#f97316"/>
            <stop offset="100%" stop-color="#ef4444"/>
          </linearGradient>
          <filter id="pinShadow" x="0" y="0" width="52" height="70" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.35)"/>
          </filter>
        </defs>
        <g filter="url(#pinShadow)">
          <path d="M26 0C14.9543 0 6 8.95431 6 20C6 33.2 26 62 26 62C26 62 46 33.2 46 20C46 8.95431 37.0457 0 26 0Z" fill="url(#pinGradient)"/>
          <circle cx="26" cy="20" r="9" fill="white" fill-opacity="0.9"/>
          <circle cx="26" cy="20" r="5" fill="#0f172a" fill-opacity="0.8"/>
        </g>
      </svg>`)
    return {
      url: `data:image/svg+xml;charset=UTF-8,${svg}`,
      scaledSize: new window.google.maps.Size(40, 54),
      anchor: new window.google.maps.Point(20, 54),
    } as google.maps.Icon
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
                  <div className="flex flex-col items-center">
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/80 text-xs shadow-lg shadow-black/40">
                      <div className="bg-gradient-to-r from-amber-400/90 via-orange-500/80 to-rose-500/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                        {marker.property.name}
                      </div>
                      <div className="px-3 py-2 text-[11px] text-white/70">
                        <p className="leading-snug">{formatPropertyAddress(marker.property)}</p>
                      </div>
                    </div>
                    <div className="-mt-1 h-3 w-3 rotate-45 border border-white/10 bg-black/80" />
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
