// app/ops/admin/AdminConsole.tsx
'use client'

import { useMemo, type ReactNode } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import {
  assignWorkerAction,
  createClientAction,
  createPropertyAction,
  createScheduleAction,
  initialActionState,
  type ActionState,
} from './actions'

type ClientAccount = {
  id: string
  name: string
  contact_email?: string | null
  contact_phone?: string | null
}

type PropertyRecord = {
  id: string
  account_id: string | null
  client_name: string | null
  address: string | null
  collection_day: string | null
  put_bins_out: string | null
  assigned_to: string | null
}

type ScheduleRecord = {
  id: string
  property_id: string
  out_weekdays: (number | string)[] | null
  in_weekdays: (number | string)[] | null
}

type WorkerRecord = {
  user_id: string
  full_name: string | null
  role: string | null
}

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
]

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <header className="space-y-1">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description ? (
        <p className="text-sm text-white/60">{description}</p>
      ) : null}
    </header>
  )
}

function FormStatusMessage({ state }: { state: ActionState }) {
  if (!state.message) return null
  return (
    <p
      className={`text-sm ${state.ok ? 'text-emerald-400' : 'text-red-400'}`}
      role="status"
      aria-live="polite"
    >
      {state.message}
    </p>
  )
}

function SubmitButton({ label }: { label: string }) {
  const status = useFormStatus()
  return (
    <button
      type="submit"
      className="rounded-md bg-binbird-red px-4 py-2 text-sm font-medium text-white transition hover:bg-binbird-red/90 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={status.pending}
    >
      {status.pending ? 'Saving…' : label}
    </button>
  )
}

function InfoList({ title, items }: { title: string; items: ReactNode[] }) {
  if (!items.length) return null
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <h4 className="text-sm font-semibold uppercase tracking-wide text-white/50">{title}</h4>
      <ul className="mt-2 space-y-1 text-sm text-white/80">
        {items.map((item, index) => (
          <li key={index} className="rounded-md bg-white/5 px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}

type AdminConsoleProps = {
  clients: ClientAccount[]
  properties: PropertyRecord[]
  schedules: ScheduleRecord[]
  workers: WorkerRecord[]
  errors: string[]
}

export function AdminConsole({ clients, properties, schedules, workers, errors }: AdminConsoleProps) {
  const [clientState, clientAction] = useFormState(createClientAction, initialActionState)
  const [propertyState, propertyAction] = useFormState(createPropertyAction, initialActionState)
  const [scheduleState, scheduleAction] = useFormState(createScheduleAction, initialActionState)
  const [assignState, assignAction] = useFormState(assignWorkerAction, initialActionState)

  const scheduleMap = useMemo(() => {
    const map = new Map<string, ScheduleRecord>()
    schedules.forEach((schedule) => {
      map.set(schedule.property_id, schedule)
    })
    return map
  }, [schedules])

  const propertyOptions = useMemo(
    () =>
      properties.map((property) => ({
        id: property.id,
        label: `${property.client_name ?? 'Property'} — ${property.address ?? 'No address'}`,
        accountId: property.account_id,
        assignedTo: property.assigned_to,
      })),
    [properties],
  )

  const workersById = useMemo(() => {
    const map = new Map<string, WorkerRecord>()
    workers.forEach((worker) => {
      if (worker.user_id) {
        map.set(worker.user_id, worker)
      }
    })
    return map
  }, [workers])

  const propertyInfoItems = propertyOptions.map((property) => {
    const schedule = scheduleMap.get(property.id)
    const assignedWorker = property.assignedTo ? workersById.get(property.assignedTo) : null
    const formatDays = (values: (number | string)[] | null | undefined) =>
      values && values.length
        ? values
            .map((value) => {
              const numeric = typeof value === 'number' ? value : Number(value)
              const label = WEEKDAYS.find((day) => day.value === numeric)?.label
              return label ?? String(value)
            })
            .join(', ')
        : '—'

    return (
      <div className="space-y-1" key={property.id}>
        <p className="font-medium text-white">{property.label}</p>
        <p className="text-xs text-white/50">
          Client ID: <span className="font-mono">{property.accountId ?? 'Unknown'}</span>
        </p>
        <p className="text-xs text-white/50">
          Assigned to: {assignedWorker?.full_name ?? 'Unassigned'}
        </p>
        <p className="text-xs text-white/50">
          Put out: {schedule ? formatDays(schedule.out_weekdays ?? null) : '—'} | Bring in:{' '}
          {schedule ? formatDays(schedule.in_weekdays ?? null) : '—'}
        </p>
      </div>
    )
  })

  return (
    <div className="space-y-10">
      {errors.length ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          <p className="font-semibold">We hit a snag loading some data:</p>
          <ul className="mt-2 list-disc pl-5">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="rounded-lg border border-white/10 bg-white/[0.02] p-6">
        <SectionHeading
          title="Create client account"
          description="Add a new client account so you can connect properties and generate tokens."
        />
        <form action={clientAction} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-white/70">
            Client name
            <input
              type="text"
              name="name"
              required
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
              placeholder="Acme Corp"
            />
          </label>
          <label className="text-sm text-white/70">
            Contact email
            <input
              type="email"
              name="contactEmail"
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
              placeholder="ops@acme.com"
            />
          </label>
          <label className="text-sm text-white/70">
            Contact phone
            <input
              type="tel"
              name="contactPhone"
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
              placeholder="+61 400 000 000"
            />
          </label>
          <div className="flex items-end justify-end">
            <SubmitButton label="Create client" />
          </div>
          <div className="md:col-span-2">
            <FormStatusMessage state={clientState} />
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/[0.02] p-6">
        <SectionHeading
          title="Add property"
          description="Connect a new property to an account, configure basic service info, and optionally assign a crew member."
        />
        <form action={propertyAction} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-white/70">
            Client account
            <select
              name="accountId"
              required
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
              defaultValue=""
            >
              <option value="" disabled>
                Select client…
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-white/70">
            Property name
            <input
              type="text"
              name="clientName"
              required
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
              placeholder="Penthouse - Collins St"
            />
          </label>
          <label className="text-sm text-white/70 md:col-span-2">
            Address
            <input
              type="text"
              name="address"
              required
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
              placeholder="123 Collins Street, Melbourne"
            />
          </label>
          <label className="text-sm text-white/70">
            Put bins out day
            <input
              type="text"
              name="putOutDay"
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
              placeholder="Monday evening"
            />
          </label>
          <label className="text-sm text-white/70">
            Collection day
            <input
              type="text"
              name="collectionDay"
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
              placeholder="Tuesday"
            />
          </label>
          <label className="text-sm text-white/70 md:col-span-2">
            Notes
            <textarea
              name="notes"
              rows={3}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
              placeholder="Gate code, bin room location, special instructions…"
            />
          </label>
          <label className="text-sm text-white/70">
            Property email
            <input
              type="email"
              name="email"
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
              placeholder="manager@building.com"
            />
          </label>
          <label className="text-sm text-white/70">
            Monthly price (AUD)
            <input
              type="number"
              name="pricePerMonth"
              min={0}
              step="0.01"
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
              placeholder="149"
            />
          </label>
          <label className="text-sm text-white/70">
            Latitude
            <input
              type="number"
              name="latitude"
              step="any"
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            />
          </label>
          <label className="text-sm text-white/70">
            Longitude
            <input
              type="number"
              name="longitude"
              step="any"
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            />
          </label>
          <label className="text-sm text-white/70 md:col-span-2">
            Assign worker
            <select
              name="assignedTo"
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
              defaultValue=""
            >
              <option value="">Unassigned</option>
              {workers.map((worker) => (
                <option key={worker.user_id} value={worker.user_id}>
                  {worker.full_name ?? worker.user_id}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2 flex items-center justify-end">
            <SubmitButton label="Create property" />
          </div>
          <div className="md:col-span-2">
            <FormStatusMessage state={propertyState} />
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/[0.02] p-6">
        <SectionHeading
          title="Manage bin schedules"
          description="Set which days crews put bins out and bring them back for each property."
        />
        <form action={scheduleAction} className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-white/70">
              Property
              <select
                name="propertyId"
                required
                className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
                defaultValue=""
              >
                <option value="" disabled>
                  Select property…
                </option>
                {propertyOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-2 text-sm text-white/70">
              <span>Put bins out</span>
              <div className="flex flex-wrap gap-3">
                {WEEKDAYS.map((day) => (
                  <label key={day.value} className="flex items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 py-2">
                    <input type="checkbox" name="outWeekdays" value={day.value} className="accent-binbird-red" />
                    <span>{day.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2 text-sm text-white/70">
              <span>Bring bins in</span>
              <div className="flex flex-wrap gap-3">
                {WEEKDAYS.map((day) => (
                  <label key={day.value} className="flex items-center gap-2 rounded-md border border-white/10 bg-black/30 px-3 py-2">
                    <input type="checkbox" name="inWeekdays" value={day.value} className="accent-binbird-red" />
                    <span>{day.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end">
            <SubmitButton label="Save schedule" />
          </div>
          <FormStatusMessage state={scheduleState} />
        </form>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/[0.02] p-6">
        <SectionHeading
          title="Assign worker"
          description="Update who is responsible for a property."
        />
        <form action={assignAction} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-white/70">
            Property
            <select
              name="propertyId"
              required
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
              defaultValue=""
            >
              <option value="" disabled>
                Select property…
              </option>
              {propertyOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-white/70">
            Worker
            <select
              name="workerId"
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
              defaultValue=""
            >
              <option value="">Unassigned</option>
              {workers.map((worker) => (
                <option key={worker.user_id} value={worker.user_id}>
                  {worker.full_name ?? worker.user_id}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2 flex items-center justify-end">
            <SubmitButton label="Update assignment" />
          </div>
          <div className="md:col-span-2">
            <FormStatusMessage state={assignState} />
          </div>
        </form>
      </section>

      <InfoList title="Current properties" items={propertyInfoItems} />
    </div>
  )
}

export type { ClientAccount, PropertyRecord, ScheduleRecord, WorkerRecord }

