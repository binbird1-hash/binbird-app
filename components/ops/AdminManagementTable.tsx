'use client'

import { useMemo, useState, useTransition } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { updateClientProperty } from '@/app/ops/manage/actions'

export type AdminStaffMember = {
  id: string
  name: string
  role: string
}

export type AdminManagedProperty = {
  id: string
  accountId: string
  accountName: string
  propertyLabel: string
  clientName: string | null
  companyName: string | null
  address: string
  collectionDay: string | null
  putBinsOut: string | null
  notes: string | null
  assignedTo: string | null
  binSummary: string | null
}

export type AdminAccountGroup = {
  id: string
  name: string
  properties: AdminManagedProperty[]
}

type SaveStatus = {
  variant: 'success' | 'error'
  message: string
}

type Props = {
  accounts: AdminAccountGroup[]
  staff: AdminStaffMember[]
}

function extractFieldError(fieldErrors: Record<string, string[]> | undefined): string | null {
  if (!fieldErrors) return null
  for (const key of Object.keys(fieldErrors)) {
    const first = fieldErrors[key]?.[0]
    if (first) return first
  }
  return null
}

export default function AdminManagementTable({ accounts, staff }: Props) {
  const [statusByProperty, setStatusByProperty] = useState<Record<string, SaveStatus>>({})
  const [pendingPropertyId, setPendingPropertyId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const hasAccounts = accounts.length > 0

  const staffOptions = useMemo(
    () =>
      [{ id: '', name: 'Unassigned', role: 'none' }, ...staff].map((member) => ({
        value: member.id,
        label: member.name.trim().length ? member.name : 'Unnamed staff member',
        role: member.role,
      })),
    [staff],
  )

  const handleSubmit = (propertyId: string, formData: FormData) => {
    const address = (formData.get('address') as string | null)?.trim() ?? ''
    const collectionDay = (formData.get('collectionDay') as string | null)?.trim() ?? ''
    const putBinsOut = (formData.get('putBinsOut') as string | null)?.trim() ?? ''
    const notes = (formData.get('notes') as string | null)?.trim() ?? ''
    const assignedToRaw = (formData.get('assignedTo') as string | null)?.trim() ?? ''
    const assignedTo = assignedToRaw.length ? assignedToRaw : null

    startTransition(async () => {
      setPendingPropertyId(propertyId)
      setStatusByProperty((prev) => {
        const next = { ...prev }
        delete next[propertyId]
        return next
      })

      try {
        const result = await updateClientProperty({
          id: propertyId,
          address,
          collectionDay,
          putBinsOut,
          notes,
          assignedTo,
        })

        if (!result.success) {
          const fieldError = extractFieldError(result.fieldErrors)
          setStatusByProperty((prev) => ({
            ...prev,
            [propertyId]: {
              variant: 'error',
              message: fieldError ?? result.error ?? 'Unable to save changes.',
            },
          }))
        } else {
          setStatusByProperty((prev) => ({
            ...prev,
            [propertyId]: {
              variant: 'success',
              message: 'Changes saved successfully.',
            },
          }))
        }
      } catch (error) {
        console.error('Failed to update client property', error)
        setStatusByProperty((prev) => ({
          ...prev,
          [propertyId]: {
            variant: 'error',
            message: 'Unexpected error occurred while saving changes.',
          },
        }))
      } finally {
        setPendingPropertyId(null)
      }
    })
  }

  if (!hasAccounts) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
        There are no client properties to manage yet.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {accounts.map((account) => (
        <section key={account.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-gray-100 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">{account.name}</h3>
              <p className="text-xs text-gray-500">
                {account.properties.length} {account.properties.length === 1 ? 'property' : 'properties'} linked to this account
              </p>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {account.properties.map((property) => {
              const status = statusByProperty[property.id]
              const isSaving = isPending && pendingPropertyId === property.id
              return (
                <form
                  key={property.id}
                  className="grid gap-4 px-4 py-5 sm:grid-cols-[minmax(0,320px)_1fr]"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const form = event.currentTarget
                    const data = new FormData(form)
                    handleSubmit(property.id, data)
                  }}
                >
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{property.propertyLabel}</h4>
                      <p className="text-xs text-gray-500">
                        {property.companyName || property.clientName || 'Client account'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white/60 p-3 text-xs text-gray-600">
                      <p className="font-medium text-gray-800">Schedule</p>
                      <dl className="mt-1 space-y-1">
                        <div className="flex justify-between gap-2">
                          <dt>Put bins out:</dt>
                          <dd className="text-right font-medium text-gray-900">
                            {property.putBinsOut?.length ? property.putBinsOut : '—'}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt>Collection day:</dt>
                          <dd className="text-right font-medium text-gray-900">
                            {property.collectionDay?.length ? property.collectionDay : '—'}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt>Bins:</dt>
                          <dd className="text-right font-medium text-gray-900">
                            {property.binSummary?.length ? property.binSummary : '—'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <label htmlFor={`address-${property.id}`} className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Service address
                      </label>
                      <textarea
                        id={`address-${property.id}`}
                        name="address"
                        defaultValue={property.address}
                        rows={2}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#ff5757] focus:outline-none focus:ring-2 focus:ring-[#ff5757]/40"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
                      <div className="grid gap-2">
                        <label htmlFor={`collectionDay-${property.id}`} className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Collection day
                        </label>
                        <input
                          id={`collectionDay-${property.id}`}
                          name="collectionDay"
                          defaultValue={property.collectionDay ?? ''}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#ff5757] focus:outline-none focus:ring-2 focus:ring-[#ff5757]/40"
                        />
                      </div>
                      <div className="grid gap-2">
                        <label htmlFor={`putBinsOut-${property.id}`} className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Put bins out
                        </label>
                        <input
                          id={`putBinsOut-${property.id}`}
                          name="putBinsOut"
                          defaultValue={property.putBinsOut ?? ''}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#ff5757] focus:outline-none focus:ring-2 focus:ring-[#ff5757]/40"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <label htmlFor={`notes-${property.id}`} className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Internal notes
                      </label>
                      <textarea
                        id={`notes-${property.id}`}
                        name="notes"
                        defaultValue={property.notes ?? ''}
                        rows={3}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#ff5757] focus:outline-none focus:ring-2 focus:ring-[#ff5757]/40"
                      />
                    </div>

                    <div className="grid gap-2">
                      <label htmlFor={`assignedTo-${property.id}`} className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Assigned staff
                      </label>
                      <select
                        id={`assignedTo-${property.id}`}
                        name="assignedTo"
                        defaultValue={property.assignedTo ?? ''}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#ff5757] focus:outline-none focus:ring-2 focus:ring-[#ff5757]/40"
                      >
                        {staffOptions.map((option) => (
                          <option key={`${property.id}-${option.value || 'unassigned'}`} value={option.value}>
                            {option.label}
                            {option.role !== 'none' ? option.role === 'admin' ? ' (Admin)' : ' (Staff)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-lg bg-[#ff5757] px-4 py-2 text-sm font-semibold text-black shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#ff5757]/40 disabled:cursor-not-allowed disabled:opacity-70"
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving…
                          </>
                        ) : (
                          'Save changes'
                        )}
                      </button>
                      {status && (
                        <div
                          className={`inline-flex items-center gap-1 text-sm ${
                            status.variant === 'success' ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {status.variant === 'success' ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <AlertCircle className="h-4 w-4" />
                          )}
                          <span>{status.message}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </form>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
