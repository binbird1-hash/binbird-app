import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PropertyDashboard } from '@/components/client/PropertyDashboard'
import type { Property } from '@/components/client/ClientPortalProvider'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

const baseProperty: Property = {
  id: 'property-1',
  name: 'BinBird HQ',
  addressLine: '123 Sample Street',
  suburb: 'Central',
  city: 'Wellington',
  status: 'active',
  binTypes: ['garbage', 'recycling', 'compost'],
  binCounts: {
    garbage: 2,
    recycling: 1,
    compost: 1,
    total: 4,
  },
  binDescriptions: {
    garbage: 'Weekly (Mon) — front gate',
    recycling: 'Fortnightly (Wed)',
    compost: null,
  },
  nextServiceAt: '2024-06-01T00:00:00.000Z',
  latitude: null,
  longitude: null,
  pricePerMonth: null,
  trialStart: null,
  membershipStart: null,
  notes: null,
  putOutDay: 'Tuesday',
  collectionDay: 'Wednesday',
}

describe('PropertyDashboard', () => {
  it('renders inline bin summaries with bold counts and unique address lines', () => {
    render(<PropertyDashboard isLoading={false} properties={[baseProperty]} />)

    const address = '123 Sample Street, Central, Wellington'
    expect(screen.getAllByText(address)).toHaveLength(1)

    const card = screen.getByRole('button', { name: 'View job history for BinBird HQ' })

    const garbageSummary = within(card).getByText((content, node) => node?.textContent === '2 Garbage Bins')
    expect(garbageSummary).toHaveClass('whitespace-nowrap')

    const boldCount = within(garbageSummary).getByText('2')
    expect(boldCount).toHaveClass('font-semibold', { exact: false })

    expect(within(card).getByText((content, node) => node?.textContent === '1 Recycling Bin')).toBeInTheDocument()
    expect(within(card).getByText((content, node) => node?.textContent === '1 Compost Bin')).toBeInTheDocument()

    expect(within(card).getByText((content, node) => node?.textContent === '4 Total Bins')).toBeInTheDocument()
  })
})
