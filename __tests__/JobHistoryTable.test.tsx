import { render, screen, within } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { JobHistoryTable } from '@/components/client/JobHistoryTable'
import type { Job, Property } from '@/components/client/ClientPortalProvider'

vi.mock('@/components/client/ClientPortalProvider', () => ({
  useClientPortal: () => ({ selectedAccount: { name: 'Test account' } }),
}))

const jobs: Job[] = [
  {
    id: '1',
    accountId: 'a',
    propertyId: 'p1',
    propertyName: 'Alpha',
    status: 'completed',
    scheduledAt: new Date().toISOString(),
    etaMinutes: 12,
    startedAt: null,
    completedAt: new Date().toISOString(),
    crewName: null,
    proofPhotoKeys: [],
    routePolyline: null,
    lastLatitude: null,
    lastLongitude: null,
    notes: null,
  },
]

const properties: Property[] = [
  {
    id: 'p1',
    name: 'Alpha',
    addressLine: '1 Main',
    suburb: 'Richmond',
    city: 'Melbourne',
    status: 'active',
    binTypes: ['General'],
    nextServiceAt: null,
    latitude: null,
    longitude: null,
  },
]

describe('JobHistoryTable', () => {
  it('renders job rows', () => {
    render(<JobHistoryTable jobs={jobs} properties={properties} />)
    const table = screen.getByRole('table')
    expect(within(table).getByRole('cell', { name: 'Alpha' })).toBeInTheDocument()
    expect(screen.getByText(/Test account/)).toBeInTheDocument()
  })
})
