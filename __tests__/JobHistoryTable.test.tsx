import { fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { JobHistoryTable } from '@/components/client/JobHistoryTable'
import type { Job, Property } from '@/components/client/ClientPortalProvider'

vi.mock('@/components/client/ClientPortalProvider', () => ({
  useClientPortal: () => ({ selectedAccount: { name: 'Test account' } }),
}))

vi.mock('@/components/client/ProofGalleryModal', () => ({
  ProofGalleryModal: () => null,
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
    jobType: 'bring_in',
    bins: ['Garbage', 'Recycling'],
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
    binCounts: { garbage: 1, recycling: 0, compost: 0, total: 1 },
    binDescriptions: { garbage: 'Garbage (weekly)', recycling: null, compost: null },
    nextServiceAt: null,
    latitude: null,
    longitude: null,
    pricePerMonth: 0,
    trialStart: null,
    membershipStart: null,
    notes: null,
    putOutDay: null,
    collectionDay: null,
  },
]

describe('JobHistoryTable', () => {
  it('renders job rows', () => {
    render(<JobHistoryTable jobs={jobs} properties={properties} />)
    const table = screen.getByRole('table')
    expect(within(table).getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText(/Test account/)).toBeInTheDocument()
  })

  it('shows inline search suggestions matching the dashboard style', () => {
    render(<JobHistoryTable jobs={jobs} properties={properties} />)
    const searchInput = screen.getByRole('searchbox', { name: /search/i })
    fireEvent.change(searchInput, { target: { value: 'mai' } })

    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1 Main, Richmond, Melbourne' })).toBeInTheDocument()
  })
})
