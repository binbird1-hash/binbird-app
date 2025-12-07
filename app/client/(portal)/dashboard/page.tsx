'use client'

import { useClientPortal } from '@/components/client/ClientPortalProvider'
import { PropertyDashboard } from '@/components/client/PropertyDashboard'

export default function ClientDashboardPage() {
  const { properties, propertiesLoading } = useClientPortal()

  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-slate-900">Property overview</h2>
      </div>
      <PropertyDashboard properties={properties} isLoading={propertiesLoading} />
    </section>
  )
}
