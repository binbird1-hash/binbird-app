// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  if (pathname.startsWith('/_next/')) {
    return NextResponse.next()
  }

  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Staff & Ops routes → require login
  if (!session && (pathname.startsWith('/staff') || pathname.startsWith('/ops'))) {
    return NextResponse.redirect(new URL('/auth', req.url))
  }

  if (session) {
    const { data: role, error } = await supabase.rpc('get_my_role')
    if (!error) {
      if (pathname.startsWith('/staff') && role !== 'staff' && role !== 'admin') {
        return NextResponse.redirect(new URL('/', req.url))
      }
      if (pathname.startsWith('/ops') && role !== 'admin') {
        return NextResponse.redirect(new URL('/', req.url))
      }
    }
  }

  // Check client portal tokens
  if (pathname.startsWith('/c/') && !pathname.startsWith('/c/error')) {
    const token = pathname.split('/c/')[1]
    if (token) {
      const { data } = await supabase
        .from('client_token')
        .select('token')
        .eq('token', token)
        .maybeSingle()

      if (!data) {
        return NextResponse.redirect(new URL('/c/error', req.url))
      }
    } else {
      return NextResponse.redirect(new URL('/c/error', req.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
