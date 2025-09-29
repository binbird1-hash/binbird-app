'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { supabaseServer } from '@/lib/supabaseServer'

const updateClientSchema = z.object({
  id: z.string().min(1, 'Client id is required.'),
  address: z.string().max(500, 'Address is too long.').optional(),
  collectionDay: z.string().max(120, 'Collection day is too long.').optional(),
  putBinsOut: z.string().max(120, 'Put bins out value is too long.').optional(),
  notes: z.string().max(2000, 'Notes are too long.').optional(),
  assignedTo: z.string().min(1).nullable().optional(),
})

export type UpdateClientInput = z.infer<typeof updateClientSchema>

export type UpdateClientResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }

export async function updateClientProperty(payload: UpdateClientInput): Promise<UpdateClientResult> {
  const normalized = {
    ...payload,
    address: payload.address?.trim(),
    collectionDay: payload.collectionDay?.trim(),
    putBinsOut: payload.putBinsOut?.trim(),
    notes: payload.notes?.trim(),
    assignedTo: payload.assignedTo ? payload.assignedTo.trim() : null,
  }

  const parsed = updateClientSchema.safeParse(normalized)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Please review the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const { id, address, collectionDay, putBinsOut, notes, assignedTo } = parsed.data

  const sb = supabaseServer()
  const {
    data: { user },
    error: authError,
  } = await sb.auth.getUser()

  if (authError) {
    console.error('Failed to resolve authenticated user when updating client', authError)
    return { success: false, error: 'Unable to verify your session.' }
  }

  if (!user) {
    return { success: false, error: 'You must be signed in to update clients.' }
  }

  const { data: profile, error: profileError } = await sb
    .from('user_profile')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Failed to load profile for user when updating client', profileError)
    return { success: false, error: 'Unable to verify your permissions.' }
  }

  if (profile?.role !== 'admin') {
    return { success: false, error: 'You do not have permission to update clients.' }
  }

  const updates: Record<string, string | null> = {
    address: address && address.length ? address : null,
    collection_day: collectionDay && collectionDay.length ? collectionDay : null,
    put_bins_out: putBinsOut && putBinsOut.length ? putBinsOut : null,
    notes: notes && notes.length ? notes : null,
    assigned_to: assignedTo ?? null,
  }

  const { error: updateError } = await sb
    .from('client_list')
    .update(updates)
    .eq('id', id)

  if (updateError) {
    console.error('Failed to update client property', updateError)
    return { success: false, error: 'Failed to save changes to the client record.' }
  }

  revalidatePath('/ops/manage')

  return { success: true }
}
