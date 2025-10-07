'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import {
  BuildingOffice2Icon,
  CursorArrowRaysIcon,
  BellAlertIcon,
  CreditCardIcon,
  Cog6ToothIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

const NAV_ITEMS = [
  { href: '/client/dashboard', label: 'Dashboard', icon: BuildingOffice2Icon },
  { href: '/client/tracker', label: 'Live tracker', icon: CursorArrowRaysIcon },
  { href: '/client/history', label: 'Job history', icon: ClockIcon },
  { href: '/client/notifications', label: 'Notifications', icon: BellAlertIcon },
  { href: '/client/billing', label: 'Billing', icon: CreditCardIcon },
  { href: '/client/settings', label: 'Settings', icon: Cog6ToothIcon },
] as const

export function PortalNavigation() {
  const pathname = usePathname()

  return (
    <nav className="flex w-full flex-nowrap items-center gap-2 overflow-x-auto rounded-3xl border border-white/15 bg-black/60 p-2 text-sm text-white backdrop-blur [-webkit-overflow-scrolling:touch] sm:flex-wrap sm:overflow-visible sm:snap-none snap-x snap-mandatory">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex min-w-[140px] flex-none snap-start items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red sm:min-w-0 sm:flex-1 sm:px-4',
              active ? 'bg-binbird-red text-white' : 'text-white/60 hover:text-white hover:bg-white/5',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
