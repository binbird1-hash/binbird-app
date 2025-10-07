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
  const addressLine = property.addressLine?.trim() || property.name?.trim() || 'Property'
  const locationParts = [property.suburb, property.city]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
  const uniqueLocationParts = locationParts.filter((part, index) => {
    return locationParts.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()) === index
  })
  const locationLine = uniqueLocationParts.join(', ')
  return { addressLine, locationLine }
}

function AddressPopoverContent({ property }: { property: Property }) {
  const { addressLine, locationLine } = formatPropertyAddress(property)
  return (
    <div className="px-3 py-2 text-[11px] text-white">
      <div className="flex flex-col gap-1 text-left">
        <p className="font-semibold text-[var(--accent)]">{addressLine}</p>
        {locationLine ? <p className="text-white/80">{locationLine}</p> : null}
      </div>
    </div>
  )
}

export function TrackerMap({ properties }: TrackerMapProps) {
  const { mapStylePref } = useMapSettings()
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const { isLoaded, loadError } = useLoadScript({
    id: 'client-tracker-map',
    googleMapsApiKey: apiKey ?? '',
  })
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)

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
    const accent = '#ff5757'
    const svg = encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?>
      <svg width="48" height="66" viewBox="0 0 48 66" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="pinShadow" x="0" y="0" width="48" height="66" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="rgba(255, 87, 87, 0.32)"/>
          </filter>
        </defs>
        <g filter="url(#pinShadow)">
          <path d="M24 0C13.5066 0 5 8.50659 5 19C5 31.98 24 58 24 58C24 58 43 31.98 43 19C43 8.50659 34.4934 0 24 0Z" fill="${accent}"/>
          <circle cx="24" cy="18" r="8.5" fill="#0b0d12" fill-opacity="0.92"/>
          <circle cx="24" cy="18" r="4.5" fill="white" fill-opacity="0.92"/>
        </g>
      </svg>`)
    return {
      url: `data:image/svg+xml;charset=UTF-8,${svg}`,
      scaledSize: new window.google.maps.Size(36, 52),
      anchor: new window.google.maps.Point(18, 52),
    } as google.maps.Icon
  }, [isLoaded])

  const handleMapLoad = useCallback((instance: google.maps.Map) => {
    setMap(instance)
  }, [])

  const handleMapUnmount = useCallback(() => {
    setMap(null)
  }, [])

  const handleMapClick = useCallback(() => {
    setSelectedPropertyId(null)
  }, [])

  return (
    <div className="relative h-80 overflow-hidden rounded-3xl border border-white/15 bg-black/60">
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
            onClick={handleMapClick}
          >
            {propertyMarkers.map((marker) => (
              <MarkerF
                key={`property-${marker.property.id}`}
                position={marker.position}
                icon={propertyIcon}
                title={marker.property.name}
                onClick={() => {
                  setSelectedPropertyId((current) =>
                    current === marker.property.id ? null : marker.property.id,
                  )
                }}
                zIndex={1}
              />
            ))}
            {propertyMarkers.map((marker) => {
              const isSelected = marker.property.id === selectedPropertyId
              if (!isSelected) {
                return (
                  <OverlayViewF
                    key={`halo-${marker.property.id}`}
                    position={marker.position}
                    mapPaneName="overlayMouseTarget"
                  >
                    <div className="pointer-events-none -translate-x-1/2 -translate-y-[58px]">
                      <span className="relative block h-12 w-12">
                        <span
                          className="absolute inset-0 animate-pulse rounded-full"
                          style={{ backgroundColor: 'rgba(255, 87, 87, 0.18)' }}
                        />
                      </span>
                    </div>
                  </OverlayViewF>
                )
              }

              return (
                <OverlayViewF
                  key={`overlay-${marker.property.id}`}
                  position={marker.position}
                  mapPaneName="overlayMouseTarget"
                  zIndex={2}
                >
                  <div
                    className="pointer-events-auto"
                    style={{ transform: 'translate(-50%, calc(-100% - 58px))' }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex flex-col items-center">
                      <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#0b0d12]/90 text-xs shadow-[0_18px_40px_rgba(0,0,0,0.55)] backdrop-blur-sm">
                        <AddressPopoverContent property={marker.property} />
                      </div>
                      <div className="-mt-1 h-3 w-3 rotate-45 border border-white/15 bg-[#0b0d12]/90" />
                    </div>
                  </div>
                </OverlayViewF>
              )
            })}
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
