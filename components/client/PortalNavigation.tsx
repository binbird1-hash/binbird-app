'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import {
  BuildingOffice2Icon,
  CursorArrowRaysIcon,
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
  { href: '/client/plan', label: 'Plan', icon: CreditCardIcon },
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

  const handleSignOut = async () => {
    try {
      setSigningOut(true)
      await supabase.auth.signOut()
    } finally {
      setSigningOut(false)
      setMobileOpen(false)
    }
  }

  const isDashboard = pathname.startsWith('/client/dashboard')

  return (
    <div className="w-full">
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="relative z-50 inline-flex items-center justify-center rounded-md p-2 text-slate-800 transition hover:text-binbird-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red"
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileOpen}
          aria-controls="client-portal-mobile-nav"
        >
          {mobileOpen ? (
            <XMarkIcon className="h-6 w-6" aria-hidden />
          ) : (
            <Bars3Icon className="h-6 w-6" aria-hidden />
          )}
        </button>

        <div
          className={clsx(
            'fixed inset-0 z-40 bg-slate-900/20 transition-opacity duration-300',
            mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />

        <aside
          id="client-portal-mobile-nav"
          className={clsx(
            'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80%] flex-col gap-6 border-r border-slate-200 bg-white px-6 py-8 text-slate-900 transition-transform duration-300',
            isDashboard && 'shadow-2xl shadow-slate-200/70',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          aria-label="Client portal navigation"
        >
          <nav className="flex flex-1 flex-col gap-2 text-sm font-medium text-slate-700">
            {NAV_ITEMS.map((item) => {
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    'flex items-center gap-3 rounded-2xl px-4 py-3 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red',
                    active
                      ? clsx('bg-binbird-red text-white', isDashboard && 'shadow-lg shadow-red-900/40')
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}

            <div className="mt-auto pt-4">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red',
                  signingOut
                    ? 'cursor-wait bg-slate-100 text-slate-500'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
                <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
              </button>
            </div>
          </nav>
        </aside>
      </div>
      <nav
        className={clsx(
          'hidden w-full flex-nowrap items-center gap-2 overflow-x-auto rounded-3xl border border-slate-200 bg-white p-2 text-sm text-slate-900 backdrop-blur [-webkit-overflow-scrolling:touch] sm:flex sm:flex-wrap sm:overflow-visible sm:snap-none snap-x snap-mandatory',
          isDashboard && 'shadow-xl shadow-slate-200/70',
        )}
      >
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex min-w-[140px] flex-none snap-start items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red sm:min-w-0 sm:flex-1 sm:px-4',
                active
                  ? clsx('bg-binbird-red text-white', isDashboard && 'shadow-lg shadow-red-900/40')
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className={clsx(
            'flex min-w-[140px] flex-none snap-start items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-binbird-red sm:min-w-0 sm:px-4',
            signingOut
              ? 'cursor-wait bg-slate-100 text-slate-500'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
          )}
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5" />
          <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
        </button>
      </nav>
    </div>
  )
}
