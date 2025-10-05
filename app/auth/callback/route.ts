// app/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { Session } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/staff/today'

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
  response.headers.set('Access-Control-Allow-Origin', req.headers.get('origin') ?? '*')

  return response
}
