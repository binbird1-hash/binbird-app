'use client'

import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { BuildingOffice2Icon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

export type AddPropertyRequest = {
  name: string
  addressLine: string
  suburb: string
  city: string
  desiredStart: string
  serviceLevel: 'standard' | 'catalog' | 'custom'
  notes: string
}

export type AddPropertyModalProps = {
  isOpen: boolean
  onClose: () => void
  onCreate: (request: AddPropertyRequest) => void
  existingPropertyCount: number
}

const SERVICE_LEVEL_OPTIONS: Array<{
  value: AddPropertyRequest['serviceLevel']
  label: string
  description: string
}> = [
  {
    value: 'standard',
    label: 'Standard servicing',
    description: 'Bin flips and contamination checks on your regular schedule.',
  },
  {
    value: 'catalog',
    label: 'Full catalog management',
    description: 'Detailed asset cataloguing with photo documentation.',
  },
  {
    value: 'custom',
    label: 'Custom program',
    description: 'Tailored activation for speciality waste streams or locations.',
  },
]

export function AddPropertyModal({ isOpen, onClose, onCreate, existingPropertyCount }: AddPropertyModalProps) {
  const [name, setName] = useState('')
  const [addressLine, setAddressLine] = useState('')
  const [suburb, setSuburb] = useState('')
  const [city, setCity] = useState('')
  const [desiredStart, setDesiredStart] = useState('')
  const [serviceLevel, setServiceLevel] = useState<AddPropertyRequest['serviceLevel']>('standard')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!isOpen) {
      return
    }
    setName('')
    setAddressLine('')
    setSuburb('')
    setCity('')
    setDesiredStart('')
    setServiceLevel('standard')
    setNotes('')
  }, [isOpen])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onCreate({ name, addressLine, suburb, city, desiredStart, serviceLevel, notes })
  }

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-6 sm:items-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-6 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-6 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-black/85 text-white shadow-2xl">
                <form onSubmit={handleSubmit} className="space-y-6 p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Dialog.Title className="text-lg font-semibold tracking-tight">Add a property</Dialog.Title>
                      <p className="mt-1 text-sm text-white/70">
                        Share the details for your next location and our onboarding team will coordinate activation.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:border-binbird-red hover:text-white"
                      aria-label="Close"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>

                  <section className="rounded-2xl border border-white/10 bg-black/60 p-4 sm:p-5">
                    <div className="flex items-center gap-3 text-sm font-semibold text-white">
                      <BuildingOffice2Icon className="h-5 w-5" />
                      You currently manage {existingPropertyCount} properties with BinBird.
                    </div>
                    <p className="mt-2 text-xs text-white/60">
                      Provide the new location details below and we will update your portfolio and service schedule.
                    </p>
                  </section>

                  <section className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <label htmlFor="property-name" className="text-xs font-semibold uppercase tracking-wide text-white/60">
                        Property name
                      </label>
                      <input
                        id="property-name"
                        type="text"
                        required
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="e.g. Riverside Apartments"
                        className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/40"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="address-line" className="text-xs font-semibold uppercase tracking-wide text-white/60">
                        Address line
                      </label>
                      <input
                        id="address-line"
                        type="text"
                        required
                        value={addressLine}
                        onChange={(event) => setAddressLine(event.target.value)}
                        placeholder="123 Example Street"
                        className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/40"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="property-suburb" className="text-xs font-semibold uppercase tracking-wide text-white/60">
                        Suburb
                      </label>
                      <input
                        id="property-suburb"
                        type="text"
                        required
                        value={suburb}
                        onChange={(event) => setSuburb(event.target.value)}
                        placeholder="Southbank"
                        className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/40"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="property-city" className="text-xs font-semibold uppercase tracking-wide text-white/60">
                        City
                      </label>
                      <input
                        id="property-city"
                        type="text"
                        required
                        value={city}
                        onChange={(event) => setCity(event.target.value)}
                        placeholder="Melbourne"
                        className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/40"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="desired-start" className="text-xs font-semibold uppercase tracking-wide text-white/60">
                        Desired start date
                      </label>
                      <input
                        id="desired-start"
                        type="date"
                        value={desiredStart}
                        onChange={(event) => setDesiredStart(event.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/40"
                      />
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-white/60">Service level</span>
                      <div className="grid gap-2">
                        {SERVICE_LEVEL_OPTIONS.map((option) => (
                          <label
                            key={option.value}
                            className={clsx(
                              'flex cursor-pointer flex-col rounded-2xl border px-4 py-3 text-left transition',
                              serviceLevel === option.value
                                ? 'border-binbird-red bg-binbird-red/10'
                                : 'border-white/10 bg-white/5 hover:border-binbird-red/60 hover:bg-white/10',
                            )}
                          >
                            <input
                              type="radio"
                              name="service-level"
                              value={option.value}
                              checked={serviceLevel === option.value}
                              onChange={() => setServiceLevel(option.value)}
                              className="sr-only"
                            />
                            <span className="text-sm font-medium text-white">{option.label}</span>
                            <span className="text-xs text-white/60">{option.description}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label htmlFor="property-notes" className="text-xs font-semibold uppercase tracking-wide text-white/60">
                        Notes for our onboarding team
                      </label>
                      <textarea
                        id="property-notes"
                        rows={4}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Share access instructions, bin locations, or unique service needs."
                        className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/40"
                      />
                    </div>
                  </section>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-white/60">
                      Our team will confirm the new property within one business day.
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-binbird-red hover:text-binbird-red"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-full bg-binbird-red px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-900/40 transition hover:bg-red-500"
                      >
                        <PlusIcon className="mr-2 h-4 w-4" /> Submit property request
                      </button>
                    </div>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
