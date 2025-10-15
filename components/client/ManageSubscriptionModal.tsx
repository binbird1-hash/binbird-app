'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { Dialog, Switch, Transition } from '@headlessui/react'
import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

export type SubscriptionPreferences = {
  planTier: 'paused' | 'starter' | 'growth' | 'enterprise'
  billingFrequency: 'monthly' | 'annual'
  autopayEnabled: boolean
  invoiceEmail: string
  notes?: string
}

export type ManageSubscriptionModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave: (preferences: SubscriptionPreferences) => void
  initialPreferences: SubscriptionPreferences
  activeProperties: number
  formattedMonthlySpend: string
  nextBillingDate?: string
  planName: string
  portalUrl?: string
}

const PLAN_OPTIONS: Array<{
  value: SubscriptionPreferences['planTier']
  label: string
  description: string
  highlight: string
}> = [
  {
    value: 'starter',
    label: 'Starter plan',
    description: 'Ideal for 1-3 active properties needing consistent waste tracking.',
    highlight: 'Includes basic bin monitoring and monthly reporting.',
  },
  {
    value: 'growth',
    label: 'Growth plan',
    description: 'Great for scaling portfolios with 4-10 properties and mixed services.',
    highlight: 'Adds advanced scheduling insights and catalog alerts.',
  },
  {
    value: 'enterprise',
    label: 'Enterprise plan',
    description: 'Best for 11+ locations or complex operational needs.',
    highlight: 'Dedicated success manager and priority routing support.',
  },
  {
    value: 'paused',
    label: 'Paused plan',
    description: 'Keep historical data available while pausing active services.',
    highlight: 'Reactivate at any time to resume scheduled collections.',
  },
]

export function ManageSubscriptionModal({
  isOpen,
  onClose,
  onSave,
  initialPreferences,
  activeProperties,
  formattedMonthlySpend,
  nextBillingDate,
  planName,
  portalUrl,
}: ManageSubscriptionModalProps) {
  const [planTier, setPlanTier] = useState<SubscriptionPreferences['planTier']>(initialPreferences.planTier)
  const [billingFrequency, setBillingFrequency] = useState<SubscriptionPreferences['billingFrequency']>(
    initialPreferences.billingFrequency,
  )
  const [autopayEnabled, setAutopayEnabled] = useState(initialPreferences.autopayEnabled)
  const [invoiceEmail, setInvoiceEmail] = useState(initialPreferences.invoiceEmail)
  const [notes, setNotes] = useState(initialPreferences.notes ?? '')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      return
    }
    setPlanTier(initialPreferences.planTier)
    setBillingFrequency(initialPreferences.billingFrequency)
    setAutopayEnabled(initialPreferences.autopayEnabled)
    setInvoiceEmail(initialPreferences.invoiceEmail)
    setNotes(initialPreferences.notes ?? '')
    setSubmitted(false)
  }, [initialPreferences, isOpen])

  const planSummary = useMemo(() => {
    const option = PLAN_OPTIONS.find((entry) => entry.value === planTier)
    return option ? option.label : planName
  }, [planTier, planName])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    onSave({ planTier, billingFrequency, autopayEnabled, invoiceEmail, notes })
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
              <Dialog.Panel className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-black/85 text-white shadow-2xl">
                <form onSubmit={handleSubmit} className="space-y-6 p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Dialog.Title className="text-lg font-semibold tracking-tight">Manage subscription</Dialog.Title>
                      <p className="mt-1 text-sm text-white/70">
                        Adjust your BinBird subscription, update billing preferences, and share context with our team.
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
                    <h2 className="text-sm font-semibold tracking-tight text-white">Current overview</h2>
                    <dl className="mt-4 grid gap-3 text-xs text-white/70 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <dt className="uppercase tracking-wide text-white/40">Plan tier</dt>
                        <dd className="mt-1 text-sm font-medium text-white">{planSummary}</dd>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <dt className="uppercase tracking-wide text-white/40">Active properties</dt>
                        <dd className="mt-1 text-sm font-medium text-white">{activeProperties}</dd>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                        <dt className="uppercase tracking-wide text-white/40">Estimated monthly spend</dt>
                        <dd className="mt-1 text-sm font-medium text-white">{formattedMonthlySpend}</dd>
                      </div>
                      {nextBillingDate ? (
                        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                          <dt className="uppercase tracking-wide text-white/40">Next billing date</dt>
                          <dd className="mt-1 text-sm font-medium text-white">{nextBillingDate}</dd>
                        </div>
                      ) : null}
                    </dl>
                    {portalUrl ? (
                      <p className="mt-4 text-xs text-white/50">
                        Need to update payment methods directly?{' '}
                        <a
                          href={portalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-binbird-red hover:underline"
                        >
                          Open the billing portal in a new tab
                        </a>
                        .
                      </p>
                    ) : null}
                  </section>

                  <section className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold tracking-tight text-white">Choose your plan</h3>
                      <p className="mt-1 text-xs text-white/60">
                        Select the plan tier that best fits your property portfolio today. Our team will confirm any changes
                        within one business day.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {PLAN_OPTIONS.map((option) => (
                        <label
                          key={option.value}
                          className={clsx(
                            'group relative flex cursor-pointer flex-col gap-2 rounded-2xl border px-4 py-3 transition',
                            planTier === option.value
                              ? 'border-binbird-red bg-binbird-red/10'
                              : 'border-white/10 bg-white/5 hover:border-binbird-red/60 hover:bg-white/10',
                          )}
                        >
                          <input
                            type="radio"
                            name="plan-tier"
                            value={option.value}
                            checked={planTier === option.value}
                            onChange={() => setPlanTier(option.value)}
                            className="sr-only"
                          />
                          <span className="flex items-center justify-between text-sm font-medium text-white">
                            {option.label}
                            {planTier === option.value ? (
                              <CheckCircleIcon className="h-5 w-5 text-binbird-red" />
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-white/40 transition group-hover:bg-binbird-red" />
                            )}
                          </span>
                          <span className="text-xs text-white/60">{option.description}</span>
                          <span className="text-xs font-semibold text-white/70">{option.highlight}</span>
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold tracking-tight text-white">Billing frequency</h3>
                        <p className="mt-1 text-xs text-white/60">Let us know how you prefer to be invoiced.</p>
                      </div>
                      <div className="grid gap-2">
                        {[
                          { value: 'monthly', label: 'Monthly billing', helper: 'Flexible month-to-month payments.' },
                          {
                            value: 'annual',
                            label: 'Annual billing',
                            helper: 'Secure annual pricing with a complimentary onboarding session.',
                          },
                        ].map((frequency) => (
                          <label
                            key={frequency.value}
                            className={clsx(
                              'flex cursor-pointer flex-col rounded-2xl border px-4 py-3 transition',
                              billingFrequency === frequency.value
                                ? 'border-binbird-red bg-binbird-red/10'
                                : 'border-white/10 bg-white/5 hover:border-binbird-red/60 hover:bg-white/10',
                            )}
                          >
                            <input
                              type="radio"
                              name="billing-frequency"
                              value={frequency.value}
                              checked={billingFrequency === frequency.value}
                              onChange={() => setBillingFrequency(frequency.value as SubscriptionPreferences['billingFrequency'])}
                              className="sr-only"
                            />
                            <span className="text-sm font-medium text-white">{frequency.label}</span>
                            <span className="text-xs text-white/60">{frequency.helper}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-semibold tracking-tight text-white">Payment preferences</h3>
                        <p className="mt-1 text-xs text-white/60">Control how we collect payments and who receives invoices.</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                        <Switch.Group as="div" className="flex items-center justify-between gap-3">
                          <div>
                            <Switch.Label className="text-sm font-medium text-white">Enable automatic payments</Switch.Label>
                            <Switch.Description className="text-xs text-white/60">
                              We will debit the saved payment method on each invoice date.
                            </Switch.Description>
                          </div>
                          <Switch
                            checked={autopayEnabled}
                            onChange={setAutopayEnabled}
                            className={clsx(
                              autopayEnabled ? 'bg-binbird-red' : 'bg-white/20',
                              'relative inline-flex h-6 w-11 items-center rounded-full transition',
                            )}
                          >
                            <span
                              className={clsx(
                                autopayEnabled ? 'translate-x-6' : 'translate-x-1',
                                'inline-block h-4 w-4 rounded-full bg-white transition',
                              )}
                            />
                          </Switch>
                        </Switch.Group>
                        <div className="space-y-2">
                          <label htmlFor="invoice-email" className="text-xs font-semibold uppercase tracking-wide text-white/60">
                            Invoice email
                          </label>
                          <input
                            id="invoice-email"
                            type="email"
                            required
                            value={invoiceEmail}
                            onChange={(event) => setInvoiceEmail(event.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/40"
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="subscription-notes" className="text-xs font-semibold uppercase tracking-wide text-white/60">
                            Notes for our team
                          </label>
                          <textarea
                            id="subscription-notes"
                            rows={4}
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            placeholder="Share billing references, purchase order numbers, or requested changes."
                            className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/40"
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-white/50">
                      {submitted ? 'We\'ll confirm any changes shortly.' : 'Changes are reviewed by our team before taking effect.'}
                    </div>
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
                        Save subscription updates
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
