'use client'

import { ChangeEvent, FormEvent, Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  CalendarIcon,
  EnvelopeIcon,
  HomeIcon,
  PencilSquareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

export type AddPropertyDialogProps = {
  isOpen: boolean
  onClose: () => void
  accountName?: string
  contactEmail?: string
}

type FormState = {
  propertyName: string
  addressLine1: string
  addressLine2: string
  suburb: string
  city: string
  state: string
  postalCode: string
  startDate: string
  instructions: string
  contactEmail: string
}

const INITIAL_FORM_STATE: FormState = {
  propertyName: '',
  addressLine1: '',
  addressLine2: '',
  suburb: '',
  city: '',
  state: '',
  postalCode: '',
  startDate: '',
  instructions: '',
  contactEmail: '',
}

export function AddPropertyDialog({ isOpen, onClose, accountName, contactEmail }: AddPropertyDialogProps) {
  const [formState, setFormState] = useState<FormState>({
    ...INITIAL_FORM_STATE,
    contactEmail: contactEmail ?? '',
  })
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setFormState({ ...INITIAL_FORM_STATE, contactEmail: contactEmail ?? '' })
      setStatus('idle')
      setErrorMessage(null)
      return
    }

    setFormState((current) => ({
      ...current,
      contactEmail: current.contactEmail || contactEmail || '',
    }))
  }, [isOpen, contactEmail])

  const handleChange = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value
    setFormState((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    if (!formState.addressLine1.trim()) {
      setErrorMessage('Please provide the property address so we know where to start service.')
      return
    }

    setStatus('submitting')

    try {
      const response = await fetch('/api/property-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formState),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const serverMessage = typeof payload?.message === 'string' ? payload.message : null
        throw new Error(serverMessage ?? 'Something went wrong while submitting your request.')
      }

      setStatus('success')
    } catch (error) {
      console.error('Failed to submit property request', error)
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'We were unable to send your property request. Please try again or contact our team.',
      )
      setStatus('error')
    }
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
          <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-6">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-black/90 text-white shadow-2xl">
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/70 transition hover:border-binbird-red hover:text-white"
                  aria-label="Close add property form"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>

                <div className="space-y-6 p-6 sm:p-8">
                  <div className="space-y-2">
                    <Dialog.Title className="text-xl font-semibold tracking-tight">Add a new property</Dialog.Title>
                    <p className="text-sm text-white/70">
                      Provide the details for the new property you’d like serviced. Our team will review the request and follow
                      up with {accountName ? `${accountName}` : 'your account contact'} to get everything started.
                    </p>
                  </div>

                  {status === 'success' ? (
                    <div className="space-y-4 rounded-2xl border border-white/10 bg-black/60 p-6 text-sm text-white/80">
                      <div className="flex items-start gap-3">
                        <HomeIcon className="mt-1 h-6 w-6 text-binbird-red" />
                        <div>
                          <h3 className="text-lg font-semibold text-white">Request received</h3>
                          <p className="mt-1 text-white/70">
                            Thank you! We’ve logged your property details and will be in touch shortly to confirm start dates and
                            onboarding information.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={onClose}
                          className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:border-binbird-red hover:text-binbird-red"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form className="space-y-6" onSubmit={handleSubmit}>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-2 text-sm">
                          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-white/50">
                            <HomeIcon className="h-4 w-4" /> Property name (optional)
                          </span>
                          <input
                            type="text"
                            name="propertyName"
                            value={formState.propertyName}
                            onChange={handleChange('propertyName')}
                            className="w-full rounded-2xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none"
                            placeholder="e.g. Warehouse 3"
                          />
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-white/50">
                            <EnvelopeIcon className="h-4 w-4" /> Contact email
                          </span>
                          <input
                            type="email"
                            name="contactEmail"
                            value={formState.contactEmail}
                            onChange={handleChange('contactEmail')}
                            className="w-full rounded-2xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none"
                            placeholder="you@company.com"
                            required
                          />
                        </label>
                      </div>

                      <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="space-y-2 text-sm sm:col-span-2">
                            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-white/50">
                              <HomeIcon className="h-4 w-4" /> Property address
                            </span>
                            <input
                              type="text"
                              name="addressLine1"
                              value={formState.addressLine1}
                              onChange={handleChange('addressLine1')}
                              className="w-full rounded-2xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none"
                              placeholder="Street address"
                              required
                            />
                          </label>
                          <label className="space-y-2 text-sm sm:col-span-2">
                            <span className="sr-only">Address line 2</span>
                            <input
                              type="text"
                              name="addressLine2"
                              value={formState.addressLine2}
                              onChange={handleChange('addressLine2')}
                              className="w-full rounded-2xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none"
                              placeholder="Apartment, suite, etc. (optional)"
                            />
                          </label>
                          <label className="space-y-2 text-sm">
                            <span className="sr-only">Suburb</span>
                            <input
                              type="text"
                              name="suburb"
                              value={formState.suburb}
                              onChange={handleChange('suburb')}
                              className="w-full rounded-2xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none"
                              placeholder="Suburb"
                            />
                          </label>
                          <label className="space-y-2 text-sm">
                            <span className="sr-only">City</span>
                            <input
                              type="text"
                              name="city"
                              value={formState.city}
                              onChange={handleChange('city')}
                              className="w-full rounded-2xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none"
                              placeholder="City"
                            />
                          </label>
                          <label className="space-y-2 text-sm">
                            <span className="sr-only">State</span>
                            <input
                              type="text"
                              name="state"
                              value={formState.state}
                              onChange={handleChange('state')}
                              className="w-full rounded-2xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none"
                              placeholder="State"
                            />
                          </label>
                          <label className="space-y-2 text-sm">
                            <span className="sr-only">Postal code</span>
                            <input
                              type="text"
                              name="postalCode"
                              value={formState.postalCode}
                              onChange={handleChange('postalCode')}
                              className="w-full rounded-2xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none"
                              placeholder="Postal code"
                            />
                          </label>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-2 text-sm sm:col-span-2">
                          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-white/50">
                            <PencilSquareIcon className="h-4 w-4" /> Special instructions
                          </span>
                          <textarea
                            name="instructions"
                            value={formState.instructions}
                            onChange={handleChange('instructions')}
                            className="w-full rounded-2xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none"
                            placeholder="Tell us about access requirements, collection notes, or onsite contacts."
                            rows={4}
                          />
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-white/50">
                            <CalendarIcon className="h-4 w-4" /> Desired service start
                          </span>
                          <input
                            type="date"
                            name="startDate"
                            value={formState.startDate}
                            onChange={handleChange('startDate')}
                            className="w-full rounded-2xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none"
                          />
                        </label>
                      </div>

                      {errorMessage && (
                        <div className="rounded-2xl border border-binbird-red/40 bg-binbird-red/10 px-4 py-3 text-sm text-binbird-red">
                          {errorMessage}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={onClose}
                          className="inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-full border border-binbird-red bg-binbird-red px-5 py-2 text-sm font-semibold text-white transition hover:border-white/10 hover:bg-transparent hover:text-binbird-red disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-white/60"
                          disabled={status === 'submitting'}
                        >
                          {status === 'submitting' ? 'Submitting…' : 'Submit request'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

