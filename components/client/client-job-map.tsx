'use client'

import { useMemo } from 'react'
import { GoogleMap, Marker, Polyline, useLoadScript } from '@react-google-maps/api'
import type { ClientJob, ClientProperty } from './types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const mapContainerStyle: google.maps.MapOptions['styles'] | undefined = undefined

const libraries: ('places' | 'geometry')[] = ['places', 'geometry']

export function ClientJobMap({ jobs, properties }: { jobs: ClientJob[]; properties: ClientProperty[] }) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
    libraries,
  })

  const markers = useMemo(() => {
    return jobs
      .filter((job) => typeof job.lat === 'number' && typeof job.lng === 'number')
      .map((job) => ({
        position: { lat: job.lat as number, lng: job.lng as number },
        job,
      }))
  }, [jobs])

  const routePath = useMemo(() => markers.map((marker) => marker.position), [markers])

  const riderPosition = useMemo(() => {
    for (const job of jobs) {
      const latestGpsLog = [...job.logs]
        .filter((log) => typeof log.gps_lat === 'number' && typeof log.gps_lng === 'number')
        .sort((a, b) => (a.gps_time ?? '').localeCompare(b.gps_time ?? ''))
        .at(-1)
      if (latestGpsLog) {
        return { lat: latestGpsLog.gps_lat as number, lng: latestGpsLog.gps_lng as number }
      }
    }
    return null
  }, [jobs])

  const boundsCenter = useMemo(() => {
    if (!markers.length && !properties.length) {
      return { lat: -37.8136, lng: 144.9631 }
    }
    const latitudes: number[] = []
    const longitudes: number[] = []
    markers.forEach((marker) => {
      latitudes.push(marker.position.lat)
      longitudes.push(marker.position.lng)
    })
    properties.forEach((property) => {
      if (property.coordinates) {
        latitudes.push(property.coordinates.lat)
        longitudes.push(property.coordinates.lng)
      }
    })
    const avgLat = latitudes.reduce((acc, value) => acc + value, 0) / latitudes.length
    const avgLng = longitudes.reduce((acc, value) => acc + value, 0) / longitudes.length
    return { lat: avgLat, lng: avgLng }
  }, [markers, properties])

  if (!isLoaded) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Live map</CardTitle>
        </CardHeader>
        <CardContent>Loading map…</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live map</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-[360px] w-full overflow-hidden rounded-xl">
          <GoogleMap
            center={boundsCenter}
            zoom={markers.length ? 12 : 11}
            mapContainerStyle={{ width: '100%', height: '100%' }}
            options={{
              disableDefaultUI: true,
              styles: mapContainerStyle,
              zoomControl: true,
            }}
          >
            {markers.map((marker) => (
              <Marker
                key={marker.job.id}
                position={marker.position}
                label={marker.job.status === 'done' ? '✓' : undefined}
              />
            ))}
            {routePath.length >= 2 ? (
              <Polyline
                path={routePath}
                options={{
                  strokeColor: '#ff5757',
                  strokeOpacity: 0.8,
                  strokeWeight: 3,
                }}
              />
            ) : null}
            {riderPosition ? (
              <Marker
                position={riderPosition}
                icon={{
                  url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                  scaledSize: new window.google.maps.Size(36, 36),
                }}
              />
            ) : null}
          </GoogleMap>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {jobs.slice(0, 6).map((job) => (
            <div key={job.id} className="flex items-center justify-between rounded-lg bg-white/5 p-3 text-sm text-white/80">
              <div>
                <div className="font-semibold">{job.address}</div>
                <div className="text-xs text-white/50">{job.job_type}</div>
              </div>
              <Badge variant={job.status === 'done' ? 'success' : job.status === 'arrived' ? 'warning' : 'info'}>
                {job.status}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
