import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { z } from 'zod'

const propertyRequestSchema = z.object({
  accountId: z.string().min(1, 'An account is required to submit a property request'),
  accountName: z.string().optional(),
  requesterEmail: z.string().email('A valid email is required').optional(),
  addressLine1: z.string().min(1, 'Street address is required'),
  addressLine2: z.string().optional(),
  suburb: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  startDate: z.string().optional(),
  instructions: z.string().optional(),
})

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch (error) {
    return NextResponse.json({ message: 'Invalid JSON payload.' }, { status: 400 })
  }

  const parseResult = propertyRequestSchema.safeParse(payload)
  if (!parseResult.success) {
    return NextResponse.json(
      {
        message: 'Please review the form and try again.',
        errors: parseResult.error.flatten(),
      },
      { status: 400 },
    )
  }

  const data = parseResult.data
  const supabase = createRouteHandlerClient({ cookies })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const insertPayload = {
    account_id: data.accountId,
    account_name: data.accountName ?? null,
    requester_email: data.requesterEmail ?? user?.email ?? null,
    address_line1: data.addressLine1,
    address_line2: data.addressLine2 ?? null,
    suburb: data.suburb ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    postal_code: data.postalCode ?? null,
    start_date: data.startDate ?? null,
    instructions: data.instructions ?? null,
    status: 'pending',
    submitted_by_user_id: user?.id ?? null,
    submitted_by_email: user?.email ?? data.requesterEmail ?? null,
  }

  const { data: insertedRow, error: insertError } = await supabase
    .from('property_requests')
    .insert(insertPayload)
    .select(
      'id, status, account_id, account_name, requester_email, address_line1, address_line2, suburb, city, state, postal_code, start_date, instructions, created_at',
    )
    .single()

  if (insertError) {
    console.error('Failed to persist property request', insertError)
    return NextResponse.json(
      { message: 'We were unable to save your request. Please try again or contact support.' },
      { status: 500 },
    )
  }

  const requestUrl = process.env.NEXT_PUBLIC_PROPERTY_REQUEST_URL ?? process.env.PROPERTY_REQUEST_URL

  if (requestUrl) {
    try {
      const forwarded = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          requestId: insertedRow?.id,
          submittedAt: new Date().toISOString(),
        }),
      })

      if (!forwarded.ok) {
        console.warn('Property request forwarding failed', forwarded.status, forwarded.statusText)
        return NextResponse.json(
          {
            message: 'Request captured, but we could not reach our scheduling system. Our team will follow up shortly.',
            requestId: insertedRow?.id ?? null,
            status: insertedRow?.status ?? 'pending',
          },
          { status: 202 },
        )
      }
    } catch (error) {
      console.warn('Property request forwarding error', error)
      return NextResponse.json(
        {
          message: 'Request captured, but we could not reach our scheduling system. Our team will follow up shortly.',
          requestId: insertedRow?.id ?? null,
          status: insertedRow?.status ?? 'pending',
        },
        { status: 202 },
      )
    }
  }

  return NextResponse.json(
    {
      message: 'Property request received.',
      requestId: insertedRow?.id ?? null,
      status: insertedRow?.status ?? 'pending',
    },
    { status: 201 },
  )
}
