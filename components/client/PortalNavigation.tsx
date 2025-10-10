'use client'

import { useEffect, useMemo, useState } from 'react'
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
  Bars3Icon,
  ChevronDownIcon,
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
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const activeItem = useMemo(
    () => NAV_ITEMS.find((item) => pathname.startsWith(item.href)) ?? NAV_ITEMS[0],
    [pathname],
  )

  return (
    <div className="w-full">
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 rounded-3xl border border-white/10 bg-black/60 px-4 py-3 text-left text-sm font-medium text-white shadow-2xl shadow-black/25 backdrop-blur transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red"
          aria-expanded={mobileOpen}
          aria-controls="client-portal-mobile-nav"
        >
          <span className="flex items-center gap-3 text-sm">
            <Bars3Icon className="h-5 w-5" aria-hidden />
            <span>{activeItem.label}</span>
          </span>
          <ChevronDownIcon
            className={clsx('h-5 w-5 transition', mobileOpen ? 'rotate-180' : '')}
            aria-hidden
          />
        </button>
        <div
          id="client-portal-mobile-nav"
          className={clsx(
            'mt-3 space-y-1 rounded-3xl border border-white/10 bg-black/80 p-2 text-sm text-white shadow-2xl shadow-black/30 backdrop-blur transition-opacity',
            mobileOpen ? 'opacity-100' : 'pointer-events-none hidden opacity-0',
          )}
        >
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red',
                  active ? 'bg-binbird-red text-white shadow-lg shadow-red-900/40' : 'text-white/70 hover:bg-white/5 hover:text-white',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
      <nav className="hidden w-full flex-nowrap items-center gap-2 overflow-x-auto rounded-3xl border border-white/10 bg-black/60 p-2 text-sm text-white shadow-2xl shadow-black/20 backdrop-blur [-webkit-overflow-scrolling:touch] sm:flex sm:flex-wrap sm:overflow-visible sm:snap-none snap-x snap-mandatory">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex min-w-[140px] flex-none snap-start items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red sm:min-w-0 sm:flex-1 sm:px-4',
                active ? 'bg-binbird-red text-white shadow-lg shadow-red-900/40' : 'text-white/60 hover:text-white hover:bg-white/5',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
