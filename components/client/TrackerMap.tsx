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

const PROPERTY_MARKER_ICON_URL =
  'data:image/svg+xml,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path
        fill="#E21C21"
        d="M16 2c-5.523 0-10 4.477-10 10 0 7.8 10 18 10 18s10-10.2 10-18c0-5.523-4.477-10-10-10Z"
      />
      <circle cx="16" cy="12" r="4" fill="white" />
    </svg>
  `)
const PROPERTY_MARKER_ICON_SIZE = { width: 32, height: 32 }
const PROPERTY_MARKER_POPUP_OFFSET_PX = PROPERTY_MARKER_ICON_SIZE.height

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

  const selectedMarker = useMemo(
    () => propertyMarkers.find((marker) => marker.property.id === selectedPropertyId) ?? null,
    [propertyMarkers, selectedPropertyId],
  )

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
    const size = new window.google.maps.Size(
      PROPERTY_MARKER_ICON_SIZE.width,
      PROPERTY_MARKER_ICON_SIZE.height,
    )
    return {
      url: PROPERTY_MARKER_ICON_URL,
      scaledSize: size,
      anchor: new window.google.maps.Point(size.width / 2, size.height),
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
            {selectedMarker && (
              <OverlayViewF
                position={selectedMarker.position}
                mapPaneName="overlayMouseTarget"
                zIndex={2}
              >
                <div
                  className="pointer-events-auto"
                  style={{ transform: `translate(-50%, calc(-100% - ${PROPERTY_MARKER_POPUP_OFFSET_PX}px))` }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex flex-col items-center">
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-xs shadow-lg">
                      <AddressPopoverContent property={selectedMarker.property} />
                    </div>
                    <div className="-mt-1 h-3 w-3 rotate-45 border border-slate-200 bg-white shadow-lg" />
                  </div>
                </div>
              </OverlayViewF>
            )}
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
