import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { randomUUID } from 'crypto'
import { z } from 'zod'

const approveBodySchema = z
  .object({
    propertyId: z.string().min(1).optional(),
  })
  .optional()

const formatAddress = (parts: Array<string | null>): string => {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part && part.length))
    .join(', ')
}

type PropertyRequestRow = {
  id: string
  status: string | null
  account_id: string | null
  account_name: string | null
  requester_email: string | null
  address_line1: string | null
  address_line2: string | null
  suburb: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  start_date: string | null
  instructions: string | null
  client_property_id: string | null
  approved_at: string | null
  approved_by: string | null
  created_at: string | null
}

type RouteContext = {
  params: { id?: string }
}

export async function POST(request: Request, { params }: RouteContext) {
  const requestId = params?.id?.trim()

  if (!requestId) {
    return NextResponse.json({ message: 'A property request ID is required.' }, { status: 400 })
  }

  let body: unknown = null
  try {
    body = await request.json()
  } catch (error) {
    body = null
  }

  const parsedBody = approveBodySchema.safeParse(body)
  const propertyIdFromBody = parsedBody.success ? parsedBody.data?.propertyId?.trim() ?? null : null

  const supabase = createRouteHandlerClient({ cookies })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: propertyRequest, error: loadError } = await supabase
    .from('property_requests')
    .select(
      'id, status, account_id, account_name, requester_email, address_line1, address_line2, suburb, city, state, postal_code, start_date, instructions, client_property_id, approved_at, approved_by, created_at',
    )
    .eq('id', requestId)
    .maybeSingle<PropertyRequestRow>()

  if (loadError) {
    console.error('Failed to load property request for approval', loadError)
    return NextResponse.json({ message: 'Unable to load property request.' }, { status: 500 })
  }

  if (!propertyRequest) {
    return NextResponse.json({ message: 'Property request not found.' }, { status: 404 })
  }

  if (propertyRequest.status && propertyRequest.status !== 'pending') {
    return NextResponse.json({ message: 'This property request has already been processed.' }, { status: 409 })
  }

  if (!propertyRequest.account_id) {
    return NextResponse.json({ message: 'Property request is missing an account reference.' }, { status: 400 })
  }

  const propertyId = propertyIdFromBody || propertyRequest.client_property_id?.trim() || randomUUID()
  const address = formatAddress([
    propertyRequest.address_line1,
    propertyRequest.address_line2,
    propertyRequest.suburb,
    propertyRequest.city,
    propertyRequest.state,
    propertyRequest.postal_code,
  ])

  const clientInsertPayload = {
    property_id: propertyId,
    account_id: propertyRequest.account_id,
    client_name: propertyRequest.account_name ?? propertyRequest.account_id,
    company: propertyRequest.account_name ?? null,
    address: address || propertyRequest.address_line1,
    notes: propertyRequest.instructions ?? null,
    email: propertyRequest.requester_email ?? null,
  }

  const { error: clientInsertError } = await supabase.from('client_list').insert(clientInsertPayload)

  if (clientInsertError) {
    console.error('Failed to create client_list entry for approved property request', clientInsertError)
    return NextResponse.json(
      { message: 'Unable to add the property to the client list. Please try again.' },
      { status: 500 },
    )
  }

  const approvedAt = new Date().toISOString()
  const { data: updatedRequest, error: updateError } = await supabase
    .from('property_requests')
    .update({
      status: 'approved',
      approved_at: approvedAt,
      approved_by: user?.id ?? null,
      client_property_id: propertyId,
    })
    .eq('id', requestId)
    .select(
      'id, status, account_id, account_name, requester_email, address_line1, address_line2, suburb, city, state, postal_code, start_date, instructions, client_property_id, approved_at, approved_by, created_at',
    )
    .single<PropertyRequestRow>()

  if (updateError || !updatedRequest) {
    console.error('Failed to update property request status after approval', updateError)
    await supabase.from('client_list').delete().eq('property_id', propertyId)
    return NextResponse.json(
      { message: 'The property was not approved due to an internal error. Please try again.' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    message: 'Property request approved.',
    propertyId,
    request: updatedRequest,
  })
}
