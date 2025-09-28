'use client'

import Link from 'next/link'
import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'
import { Users, BriefcaseBusiness, ShieldCheck } from 'lucide-react'

export type PortalRole = 'guest' | 'client' | 'staff' | 'admin'
type AccessRole = Exclude<PortalRole, 'guest'>

type PortalOption = {
  id: string
  title: string
  description: string
  href: string
  icon: LucideIcon
  allowedRoles: AccessRole[]
  lockedLabel: string
}

const portalOptions: PortalOption[] = [
  {
    id: 'client',
    title: 'Client Portal',
    description: 'Track scheduled services, review visit logs, and download proofs for your properties.',
    href: '/client',
    icon: Users,
    allowedRoles: ['client', 'admin'],
    lockedLabel: 'Requires client access',
  },
  {
    id: 'staff',
    title: 'Staff Portal',
    description: 'Access routing tools, run management, and on-the-ground reporting utilities.',
    href: '/ops',
    icon: BriefcaseBusiness,
    allowedRoles: ['staff', 'admin'],
    lockedLabel: 'Requires staff access',
  },
  {
    id: 'admin',
    title: 'Admin Portal',
    description: 'Manage users, clients, and system configuration with elevated permissions.',
    href: '/admin',
    icon: ShieldCheck,
    allowedRoles: ['admin'],
    lockedLabel: 'Requires admin access',
  },
]

type PortalPickerProps = {
  role: PortalRole | null
}

export default function PortalPicker({ role }: PortalPickerProps) {
  const normalizedRole: PortalRole = role ?? 'guest'

  const cards = portalOptions.map((portal) => {
    const isAllowed = portal.allowedRoles.includes(normalizedRole as AccessRole)
    const Icon = portal.icon

    const cardContent = (
      <article
        className={clsx(
          'relative flex h-full flex-col justify-between rounded-2xl border border-white/10 p-5 transition',
          'bg-white/[0.06] text-white shadow-lg shadow-black/20 backdrop-blur',
          isAllowed
            ? 'hover:border-[#ff5757] hover:bg-white/[0.12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff5757]'
            : 'cursor-not-allowed opacity-50'
        )}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ff5757]/10 text-[#ff5757]">
            <Icon className="h-6 w-6" />
          </span>
          <h3 className="text-lg font-semibold">{portal.title}</h3>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-white/70">{portal.description}</p>
        {!isAllowed && (
          <p className="mt-6 text-xs font-medium uppercase tracking-wide text-white/40">
            {portal.lockedLabel}
          </p>
        )}
      </article>
    )

    if (!isAllowed) {
      return (
        <div key={portal.id} className="h-full">
          {cardContent}
        </div>
      )
    }

    return (
      <Link key={portal.id} href={portal.href} className="h-full focus:outline-none">
        {cardContent}
      </Link>
    )
  })

  const hasVisibleCard = cards.some((card) => card !== null)
  if (!hasVisibleCard) {
    return null
  }

  return (
    <section aria-labelledby="portal-picker-heading" className="w-full">
      <div className="mb-6 flex flex-col gap-1">
        <h2 id="portal-picker-heading" className="text-xl font-semibold text-white">
          Choose a portal
        </h2>
        <p className="text-sm text-white/60">
          Quickly jump into the experience that matches the task you need to accomplish.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{cards}</div>
    </section>
  )
}
