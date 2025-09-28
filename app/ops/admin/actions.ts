// app/ops/admin/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabaseServer'

export type ActionState = {
  ok: boolean
  message: string
}

const DEFAULT_ERROR: ActionState = {
  ok: false,
  message: 'Something went wrong. Please try again.',
}

function handleError(message?: string): ActionState {
  return {
    ok: false,
    message: message ?? DEFAULT_ERROR.message,
  }
}

async function requireUser() {
  const sb = supabaseServer()
  const {
    data: { user },
    error,
  } = await sb.auth.getUser()

  if (error || !user) {
    throw new Error('You must be signed in to perform this action.')
  }

  return { sb, user }
}

const createClientSchema = z.object({
  name: z.string().min(1, 'Client name is required.'),
  contactEmail: z
    .string()
    .email('Enter a valid email address.')
    .optional()
    .or(z.literal('')),
  contactPhone: z
    .string()
    .trim()
    .optional()
    .or(z.literal('')),
})

export async function createClientAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let sb
  try {
    ;({ sb } = await requireUser())
  } catch (error) {
    return handleError(error instanceof Error ? error.message : undefined)
  }

  const payload = {
    name: formData.get('name'),
    contactEmail: formData.get('contactEmail'),
    contactPhone: formData.get('contactPhone'),
  }

  const parsed = createClientSchema.safeParse(payload)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return handleError(issue?.message)
  }

  const data = parsed.data
  const insertPayload = {
    name: data.name,
    contact_email: data.contactEmail?.length ? data.contactEmail : null,
    contact_phone: data.contactPhone?.length ? data.contactPhone : null,
  }

  const { error } = await sb.from('client_accounts').insert(insertPayload)

  if (error) {
    return handleError(error.message)
  }

  revalidatePath('/ops/admin')
  return {
    ok: true,
    message: 'Client created successfully.',
  }
}

const createPropertySchema = z.object({
  accountId: z.string().min(1, 'Select a client account.'),
  clientName: z
    .string()
    .trim()
    .min(1, 'Property name is required.'),
  address: z.string().trim().min(1, 'Street address is required.'),
  collectionDay: z.string().optional().or(z.literal('')),
  putOutDay: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  email: z.string().email('Enter a valid email.').optional().or(z.literal('')),
  pricePerMonth: z.string().optional().or(z.literal('')),
  latitude: z.string().optional().or(z.literal('')),
  longitude: z.string().optional().or(z.literal('')),
  assignedTo: z.string().optional().or(z.literal('')),
})

export async function createPropertyAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let sb
  try {
    ;({ sb } = await requireUser())
  } catch (error) {
    return handleError(error instanceof Error ? error.message : undefined)
  }

  const payload = {
    accountId: formData.get('accountId'),
    clientName: formData.get('clientName'),
    address: formData.get('address'),
    collectionDay: formData.get('collectionDay'),
    putOutDay: formData.get('putOutDay'),
    notes: formData.get('notes'),
    email: formData.get('email'),
    pricePerMonth: formData.get('pricePerMonth'),
    latitude: formData.get('latitude'),
    longitude: formData.get('longitude'),
    assignedTo: formData.get('assignedTo'),
  }

  const parsed = createPropertySchema.safeParse(payload)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return handleError(issue?.message)
  }

  const data = parsed.data
  let pricePerMonth: number | null = null
  if (data.pricePerMonth && data.pricePerMonth.length) {
    const parsedPrice = Number(data.pricePerMonth)
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return handleError('Monthly price must be a positive number.')
    }
    pricePerMonth = parsedPrice
  }

  let latitude: number | null = null
  if (data.latitude && data.latitude.length) {
    const parsedLat = Number(data.latitude)
    if (!Number.isFinite(parsedLat)) {
      return handleError('Latitude must be a valid number.')
    }
    latitude = parsedLat
  }

  let longitude: number | null = null
  if (data.longitude && data.longitude.length) {
    const parsedLng = Number(data.longitude)
    if (!Number.isFinite(parsedLng)) {
      return handleError('Longitude must be a valid number.')
    }
    longitude = parsedLng
  }

  const latLng =
    latitude !== null && longitude !== null ? `${latitude},${longitude}` : null

  const insertPayload = {
    account_id: data.accountId,
    client_name: data.clientName,
    address: data.address,
    collection_day: data.collectionDay?.length ? data.collectionDay : null,
    put_bins_out: data.putOutDay?.length ? data.putOutDay : null,
    notes: data.notes?.length ? data.notes : null,
    email: data.email?.length ? data.email : null,
    price_per_month: pricePerMonth,
    lat_lng: latLng,
    assigned_to: data.assignedTo?.length ? data.assignedTo : null,
  }

  const { error } = await sb.from('property').insert(insertPayload)

  if (error) {
    return handleError(error.message)
  }

  revalidatePath('/ops/admin')
  return {
    ok: true,
    message: 'Property created successfully.',
  }
}

const WEEKDAY_SCHEMA = z
  .array(z.coerce.number().int().min(1).max(7))
  .optional()
  .transform((values) => (values && values.length ? values : null))

const createScheduleSchema = z.object({
  propertyId: z.string().min(1, 'Select a property.'),
  outWeekdays: WEEKDAY_SCHEMA,
  inWeekdays: WEEKDAY_SCHEMA,
})

export async function createScheduleAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let sb
  try {
    ;({ sb } = await requireUser())
  } catch (error) {
    return handleError(error instanceof Error ? error.message : undefined)
  }

  const payload = {
    propertyId: formData.get('propertyId'),
    outWeekdays: formData.getAll('outWeekdays'),
    inWeekdays: formData.getAll('inWeekdays'),
  }

  const parsed = createScheduleSchema.safeParse(payload)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return handleError(issue?.message)
  }

  const { propertyId, outWeekdays, inWeekdays } = parsed.data

  const { error } = await sb
    .from('schedule')
    .upsert(
      {
        property_id: propertyId,
        out_weekdays: outWeekdays,
        in_weekdays: inWeekdays,
      },
      { onConflict: 'property_id' },
    )

  if (error) {
    return handleError(error.message)
  }

  revalidatePath('/ops/admin')
  return {
    ok: true,
    message: 'Bin schedule saved successfully.',
  }
}

const assignWorkerSchema = z.object({
  propertyId: z.string().min(1, 'Select a property.'),
  workerId: z
    .string()
    .optional()
    .or(z.literal('')),
})

export async function assignWorkerAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let sb
  try {
    ;({ sb } = await requireUser())
  } catch (error) {
    return handleError(error instanceof Error ? error.message : undefined)
  }

  const payload = {
    propertyId: formData.get('propertyId'),
    workerId: formData.get('workerId'),
  }

  const parsed = assignWorkerSchema.safeParse(payload)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return handleError(issue?.message)
  }

  const { propertyId, workerId } = parsed.data

  const { error } = await sb
    .from('property')
    .update({ assigned_to: workerId?.length ? workerId : null })
    .eq('id', propertyId)

  if (error) {
    return handleError(error.message)
  }

  revalidatePath('/ops/admin')
  return {
    ok: true,
    message: workerId?.length ? 'Worker assigned to property.' : 'Property unassigned successfully.',
  }
}

export const initialActionState: ActionState = {
  ok: false,
  message: '',
}
