'use client'

import { Fragment } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useClientPortal } from './ClientPortalProvider'

export function AccountSwitcher() {
  const { accounts, selectedAccount, selectAccount } = useClientPortal()

  if (accounts.length <= 1 || !selectedAccount) {
    return (
      <div className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-600">
        <UserCircleIcon className="h-5 w-5" />
        <div>
          <p className="font-medium text-slate-900">{selectedAccount?.name ?? 'Primary Account'}</p>
          <p className="text-xs uppercase tracking-wide text-slate-500">{selectedAccount?.role ?? 'Owner'}</p>
        </div>
      </div>
    )
  }

  return (
    <Listbox value={selectedAccount?.id} onChange={selectAccount}>
      {({ open }) => (
        <div className="relative w-full sm:max-w-xs">
          <Listbox.Button className="relative flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2 text-left text-sm font-medium text-slate-900 shadow-lg shadow-slate-200/60 transition hover:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30">
            <span className="flex flex-col">
              <span>{selectedAccount?.name}</span>
              <span className="text-xs uppercase tracking-wide text-slate-500">{selectedAccount?.role}</span>
            </span>
            <ChevronUpDownIcon className="h-5 w-5 text-slate-500" />
          </Listbox.Button>
          <Transition
            as={Fragment}
            show={open}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-gray-900/95 p-1 text-sm text-slate-900 shadow-xl backdrop-blur">
              {accounts.map((account) => (
                <Listbox.Option
                  key={account.id}
                  value={account.id}
                  className={({ active }) =>
                    clsx(
                      'flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition',
                      active ? 'bg-binbird-red/20 text-slate-900' : 'text-slate-700',
                    )
                  }
                >
                  {({ selected }) => (
                    <>
                      <div>
                        <p className="font-medium">{account.name}</p>
                        <p className="text-xs uppercase tracking-wide text-slate-500">{account.role}</p>
                      </div>
                      {selected && <CheckIcon className="h-4 w-4 text-binbird-red" />}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      )}
    </Listbox>
  )
}
