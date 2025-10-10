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
  XMarkIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'
import { useSupabase } from '@/components/providers/SupabaseProvider'

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
  const [signingOut, setSigningOut] = useState(false)
  const supabase = useSupabase()

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const activeItem = useMemo(
    () => NAV_ITEMS.find((item) => pathname.startsWith(item.href)) ?? NAV_ITEMS[0],
    [pathname],
  )

  const handleSignOut = async () => {
    try {
      setSigningOut(true)
      await supabase.auth.signOut()
    } finally {
      setSigningOut(false)
      setMobileOpen(false)
    }
  }

  return (
    <div className="w-full">
      <div className="sm:hidden">
        <div className="relative z-50 flex items-center justify-between rounded-3xl border border-white/10 bg-black/60 px-4 py-3 text-white shadow-2xl shadow-black/25 backdrop-blur">
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="inline-flex items-center justify-center p-2 text-white transition hover:text-binbird-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            aria-controls="client-portal-mobile-nav"
          >
            {mobileOpen ? (
              <XMarkIcon className="h-5 w-5" aria-hidden />
            ) : (
              <Bars3Icon className="h-5 w-5" aria-hidden />
            )}
          </button>
          <div className="flex flex-col items-end text-right">
            <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/40">
              Current page
            </span>
            <span className="text-sm font-semibold text-white">{activeItem.label}</span>
          </div>
        </div>

        <div
          className={clsx(
            'fixed inset-0 z-40 bg-black/60 transition-opacity duration-300',
            mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />

        <aside
          id="client-portal-mobile-nav"
          className={clsx(
            'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80%] flex-col gap-6 border-r border-white/10 bg-black/95 px-6 py-8 text-white shadow-2xl shadow-black/50 transition-transform duration-300',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          aria-label="Client portal navigation"
        >
          <nav className="flex flex-1 flex-col gap-2 text-sm font-medium text-white/80">
            {NAV_ITEMS.map((item) => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    'flex items-center gap-3 rounded-2xl px-4 py-3 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red',
                    active ? 'bg-binbird-red text-white shadow-lg shadow-red-900/40' : 'text-white/70 hover:bg-white/5 hover:text-white',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className={clsx(
              'inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red',
              signingOut
                ? 'cursor-wait bg-white/5 text-white/70'
                : 'text-white hover:border-binbird-red hover:bg-binbird-red/20',
            )}
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </aside>
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
