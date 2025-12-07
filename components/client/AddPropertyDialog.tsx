'use client'

import { ChangeEvent, FormEvent, Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { CalendarIcon, HomeIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline'

export type AddPropertyDialogProps = {
  isOpen: boolean
  onClose: () => void
  accountName?: string
  accountId?: string
  requesterEmail?: string
}

type FormState = {
  addressLine1: string
  addressLine2: string
  suburb: string
  city: string
  state: string
  postalCode: string
  startDate: string
  instructions: string
}

const INITIAL_FORM_STATE: FormState = {
  addressLine1: '',
  addressLine2: '',
  suburb: '',
  city: '',
  state: '',
  postalCode: '',
  startDate: '',
  instructions: '',
}

export function AddPropertyDialog({
  isOpen,
  onClose,
  accountName,
  accountId,
  requesterEmail,
}: AddPropertyDialogProps) {
  const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isSubmitDisabled = status === 'submitting' || !accountId

  useEffect(() => {
    if (!isOpen) {
      setFormState(INITIAL_FORM_STATE)
      setStatus('idle')
      setErrorMessage(null)
    }
  }, [isOpen])

  const handleChange = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value
    setFormState((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    if (!accountId) {
      setErrorMessage('We could not determine which account to attach this request to. Please refresh and try again.')
      return
    }

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
        body: JSON.stringify({
          ...formState,
          accountId,
          accountName,
          requesterEmail,
        }),
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
          <Dialog.Overlay className="fixed inset-0 bg-slate-50 backdrop-blur" />
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
              <Dialog.Panel className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 transition hover:border-binbird-red hover:text-slate-900"
                  aria-label="Close add property form"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>

                <div className="space-y-6 p-6 sm:p-8">
                  <div className="space-y-2">
                    <Dialog.Title className="text-xl font-semibold tracking-tight">Add a new property</Dialog.Title>
                    <p className="text-sm text-slate-600">
                      Provide the details for the new property you’d like serviced. Our team will review the request and follow
                      up with {accountName ? `${accountName}` : 'your account contact'} to get everything started.
                    </p>
                  </div>

                  {status === 'success' ? (
                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-100 p-6 text-sm text-slate-700">
                      <div className="flex items-start gap-3">
                        <HomeIcon className="mt-1 h-6 w-6 text-binbird-red" />
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">Request received</h3>
                          <p className="mt-1 text-slate-600">
                            Thank you! We’ve logged your property details and will be in touch shortly to confirm start dates and
                            onboarding information.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={onClose}
                          className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-binbird-red hover:text-binbird-red"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form className="space-y-6" onSubmit={handleSubmit}>
                      {(accountName || requesterEmail) && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 text-xs text-slate-500 sm:text-sm">
                          {accountName && (
                            <p>
                              Requesting for{' '}
                              <span className="font-medium text-slate-900">{accountName}</span>
                            </p>
                          )}
                          {requesterEmail && (
                            <p className="mt-1">
                              Confirmation will be sent to{' '}
                              <span className="font-medium text-slate-900">{requesterEmail}</span>
                            </p>
                          )}
                        </div>
                      )}
                      {!accountId && (
                        <p className="text-xs text-binbird-red">Select an account to enable property requests.</p>
                      )}

                      <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="space-y-2 text-sm sm:col-span-2">
                            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                              <HomeIcon className="h-4 w-4" /> Property address
                            </span>
                            <input
                              type="text"
                              name="addressLine1"
                              value={formState.addressLine1}
                              onChange={handleChange('addressLine1')}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-binbird-red focus:outline-none"
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
                              className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-binbird-red focus:outline-none"
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
                              className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-binbird-red focus:outline-none"
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
                              className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-binbird-red focus:outline-none"
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
                              className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-binbird-red focus:outline-none"
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
                              className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-binbird-red focus:outline-none"
                              placeholder="Postal code"
                            />
                          </label>
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-2 text-sm sm:col-span-2">
                          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                            <PencilSquareIcon className="h-4 w-4" /> Special instructions
                          </span>
                          <textarea
                            name="instructions"
                            value={formState.instructions}
                            onChange={handleChange('instructions')}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-binbird-red focus:outline-none"
                            placeholder="Tell us about access requirements, collection notes, or onsite contacts."
                            rows={4}
                          />
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                            <CalendarIcon className="h-4 w-4" /> Desired service start
                          </span>
                          <input
                            type="date"
                            name="startDate"
                            value={formState.startDate}
                            onChange={handleChange('startDate')}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-binbird-red focus:outline-none"
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
                          className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-200/30"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-full border border-binbird-red bg-binbird-red px-5 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-200 hover:bg-transparent hover:text-binbird-red disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                          disabled={isSubmitDisabled}
                        >
                          {status === 'submitting'
                            ? 'Submitting…'
                            : !accountId
                              ? 'Select an account'
                              : 'Submit request'}
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

