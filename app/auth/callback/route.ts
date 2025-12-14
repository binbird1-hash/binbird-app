// app/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { Session } from '@supabase/supabase-js'

import { normalizePortalRole, resolvePortalRoleFromUser } from '@/lib/portalRoles'
import { isEmailConfirmed } from '@/lib/auth/isEmailConfirmed'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/staff/today'

  if (code) {
    try {
      const cookieStore = cookies()
      const supabase = createRouteHandlerClient({
        cookies: () => cookieStore,
      })
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (!error) {
        const sessionUser = data.session?.user ?? data.user ?? null
        const metadataRole = resolvePortalRoleFromUser(sessionUser)
        const userId = sessionUser?.id ?? null

        if (metadataRole && userId && isEmailConfirmed(sessionUser ?? null)) {
          await supabase
            .from('user_profile')
            .upsert({ user_id: userId, role: metadataRole }, { onConflict: 'user_id' })
        }
      }
    } catch (error) {
      console.error('Auth callback GET failed:', error)
    }
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

  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({
      cookies: () => cookieStore,
    })

    if (event === 'SIGNED_OUT') {
      const { error } = await supabase.auth.signOut()
      if (error) {
        throw error
      }
    } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      if (!session) {
        return NextResponse.json(
          { received: false, error: 'Missing session for auth callback event' },
          { status: 400 }
        )
      }

      const { error } = await supabase.auth.setSession(session)
      if (error) {
        throw error
      }
    }
  } catch (error) {
    console.error('Auth callback POST failed:', error)
    return NextResponse.json({ received: false, error: 'Auth callback failed' }, { status: 500 })
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
