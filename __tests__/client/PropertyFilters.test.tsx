import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PropertyFilters } from '@/components/client/PropertyFilters'
import type { Property } from '@/components/client/ClientPortalProvider'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

const sampleProperty = (overrides: Partial<Property>): Property => ({
  id: 'property-id',
  name: 'Sample Property',
  addressLine: '1 Test Road',
  suburb: 'Central',
  city: 'Auckland',
  status: 'active',
  binTypes: ['garbage'],
  binCounts: {
    garbage: 3,
    recycling: 2,
    compost: 1,
    total: 6,
  },
  binDescriptions: {
    garbage: 'Weekly',
    recycling: 'Fortnightly',
    compost: 'Monthly',
  },
  nextServiceAt: null,
  latitude: null,
  longitude: null,
  pricePerMonth: null,
  trialStart: null,
  membershipStart: null,
  notes: null,
  putOutDay: null,
  collectionDay: null,
  ...overrides,
})

describe('PropertyFilters', () => {
  it('shows compact bin totals', () => {
    const handleChange = vi.fn()

    render(
      <PropertyFilters
        filters={{ search: '' }}
        onChange={handleChange}
        properties={[sampleProperty({ id: 'p1' }), sampleProperty({ id: 'p2' })]}
      />,
    )

    expect(screen.getByText((content, node) => node?.textContent === '6 Garbage Bins')).toBeInTheDocument()
    expect(screen.getByText((content, node) => node?.textContent === '4 Recycling Bins')).toBeInTheDocument()
    expect(screen.getByText((content, node) => node?.textContent === '2 Compost Bins')).toBeInTheDocument()
  })
})
