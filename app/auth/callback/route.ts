import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { Session } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/auth/sign-in'

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL(next, url.origin))
}

type SupabaseAuthWebhookPayload = {
  event?: string
  session?: Session | null
}

export async function POST(req: Request) {
  let payload: SupabaseAuthWebhookPayload

  try {
    payload = (await req.json()) as SupabaseAuthWebhookPayload
  } catch (error) {
    return NextResponse.json({ received: false, error: 'Invalid JSON payload' }, { status: 400 })
  }

  const { event, session } = payload
  const supabase = createRouteHandlerClient({ cookies })

  if (event === 'SIGNED_OUT') {
    await supabase.auth.signOut()
  } else if (session) {
    await supabase.auth.setSession(session)
  }

  const response = NextResponse.json({ received: true })
  response.headers.set('Cache-Control', 'no-store')

  const origin = req.headers.get('origin')
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
  }

  return response
}

export async function OPTIONS(req: Request) {
  const response = new Response(null, { status: 204 })

  const origin = req.headers.get('origin')
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
  }

  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')

  const requestedHeaders = req.headers.get('access-control-request-headers')
  if (requestedHeaders) {
    response.headers.set('Access-Control-Allow-Headers', requestedHeaders)
  }

  response.headers.set('Cache-Control', 'no-store')

  return response
}
