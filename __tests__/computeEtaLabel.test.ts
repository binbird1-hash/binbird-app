import { describe, expect, it, vi } from 'vitest'
import { computeEtaLabel, type Job } from '@/components/client/ClientPortalProvider'

const baseJob: Job = {
  id: '1',
  accountId: '1',
  propertyId: 'p1',
  propertyName: 'Property One',
  status: 'scheduled',
  scheduledAt: new Date().toISOString(),
  etaMinutes: 20,
  startedAt: null,
  completedAt: null,
  crewName: null,
  proofPhotoKeys: [],
  routePolyline: null,
  lastLatitude: null,
  lastLongitude: null,
  notes: null,
  jobType: 'bring_in',
  bins: ['Garbage'],
}

describe('computeEtaLabel', () => {
  it('returns Completed for completed jobs', () => {
    expect(computeEtaLabel({ ...baseJob, status: 'completed' })).toBe('Completed')
  })

  it('returns Skipped when skipped', () => {
    expect(computeEtaLabel({ ...baseJob, status: 'skipped' })).toBe('Skipped')
  })

  it('returns arriving now when eta is 0', () => {
    expect(computeEtaLabel({ ...baseJob, etaMinutes: 0 })).toBe('Arriving now')
  })

  it('computes relative eta when started', () => {
    vi.useFakeTimers()
    const now = new Date()
    vi.setSystemTime(now)
    const startedAt = new Date(now.getTime() - 5 * 60 * 1000).toISOString()
    expect(computeEtaLabel({ ...baseJob, status: 'scheduled', startedAt, etaMinutes: 20 })).toBe('~15 min')
    vi.useRealTimers()
  })

  it('falls back to in progress when en_route without eta', () => {
    expect(computeEtaLabel({ ...baseJob, status: 'en_route', etaMinutes: null })).toBe('In progress')
  })
})
