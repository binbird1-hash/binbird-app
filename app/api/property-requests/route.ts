import { NextResponse } from 'next/server'
import { z } from 'zod'

const propertyRequestSchema = z.object({
  propertyName: z.string().optional(),
  addressLine1: z.string().min(1, 'Street address is required'),
  addressLine2: z.string().optional(),
  suburb: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  startDate: z.string().optional(),
  instructions: z.string().optional(),
  contactEmail: z.string().email('A valid email is required'),
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
  const requestUrl = process.env.NEXT_PUBLIC_PROPERTY_REQUEST_URL ?? process.env.PROPERTY_REQUEST_URL

  if (requestUrl) {
    try {
      const forwarded = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...data, submittedAt: new Date().toISOString() }),
      })

      if (!forwarded.ok) {
        console.warn('Property request forwarding failed', forwarded.status, forwarded.statusText)
        return NextResponse.json(
          { message: 'Request captured, but we could not reach our scheduling system. Our team will follow up shortly.' },
          { status: 202 },
        )
      }
    } catch (error) {
      console.warn('Property request forwarding error', error)
      return NextResponse.json(
        { message: 'Request captured, but we could not reach our scheduling system. Our team will follow up shortly.' },
        { status: 202 },
      )
    }
  }

  return NextResponse.json({ message: 'Property request received.' })
}
