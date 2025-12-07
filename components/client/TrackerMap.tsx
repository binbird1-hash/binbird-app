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
    <div className="px-3 py-2 text-[11px] text-slate-900">
      <div className="flex flex-col gap-1 text-left">
        <p className="font-semibold text-[#E21C21]">{addressLine}</p>
        {locationLine ? <p className="text-slate-900">{locationLine}</p> : null}
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
      styles: MAP_STYLE_LOOKUP[mapStylePref] ?? lightMapStyle,
      disableDefaultUI: true,
      zoomControl: true,
      fullscreenControl: false,
      streetViewControl: false,
      gestureHandling: 'greedy',
      backgroundColor: '#ffffff',
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
    const accent = '#E21C21'
    const svg = encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?>
      <svg width="32" height="44" viewBox="0 0 32 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="pinShadow" x="0" y="0" width="32" height="44" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(226, 28, 33, 0.24)"/>
          </filter>
        </defs>
        <g filter="url(#pinShadow)">
          <path d="M16 1C9.92487 1 5 5.92487 5 12C5 20.76 16 37 16 37C16 37 27 20.76 27 12C27 5.92487 22.0751 1 16 1Z" fill="#0B0D12" stroke="#0B0D12" stroke-width="1.5"/>
          <circle cx="16" cy="13" r="4.25" fill="${accent}" stroke="#0B0D12" stroke-width="1.25"/>
        </g>
      </svg>`)
    return {
      url: `data:image/svg+xml;charset=UTF-8,${svg}`,
      scaledSize: new window.google.maps.Size(28, 38),
      anchor: new window.google.maps.Point(14, 38),
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
    <div className="relative h-80 overflow-hidden rounded-3xl border border-slate-200 bg-white">
      {!apiKey ? (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-500">
          Add a Google Maps API key to view your properties on the map.
        </div>
      ) : loadError ? (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-500">
          We couldn’t load the map right now. Please refresh to try again.
        </div>
      ) : !isLoaded ? (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500">Loading map…</div>
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
                    <div className="pointer-events-none -translate-x-1/2 -translate-y-[52px]">
                      <span className="relative block h-9 w-9">
                        <span
                          className="absolute inset-0 animate-pulse rounded-full"
                          style={{ backgroundColor: 'rgba(226, 28, 33, 0.18)' }}
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
                    style={{ transform: 'translate(-50%, calc(-100% - 52px))' }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex flex-col items-center">
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-xs shadow-lg">
                        <AddressPopoverContent property={marker.property} />
                      </div>
                      <div className="-mt-1 h-3 w-3 rotate-45 border border-slate-200 bg-white shadow-lg" />
                    </div>
                  </div>
                </OverlayViewF>
              )
            })}
          </GoogleMap>
          {propertyMarkers.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-500">
              Add latitude and longitude to your properties to see them appear on the map.
            </div>
          )}
        </>
      )}
    </div>
  )
}
