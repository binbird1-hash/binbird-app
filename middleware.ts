// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { ACTIVE_RUN_COOKIE_NAME } from '@/lib/active-run-cookie'
import type { Database } from '@/lib/database.types'

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  if (pathname.startsWith('/_next/')) {
    return NextResponse.next()
  }

  const res = NextResponse.next()
  const supabase = createMiddlewareClient<Database>({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const hasActiveRunCookie = req.cookies.get(ACTIVE_RUN_COOKIE_NAME)?.value === 'true'

  const roleRestrictedPrefixes: Record<string, Array<'admin' | 'staff' | 'client'>> = {
    '/admin': ['admin'],
    '/staff': ['staff', 'admin'],
    '/client': ['client'],
  }

  const requiresAuth = Object.keys(roleRestrictedPrefixes).some((prefix) =>
    pathname.startsWith(prefix)
  )

  if (!session && requiresAuth) {
    const redirectResponse = NextResponse.redirect(new URL('/auth/sign-in', req.url))
    if (hasActiveRunCookie) {
      redirectResponse.cookies.delete(ACTIVE_RUN_COOKIE_NAME)
    }
    return redirectResponse
  }

  if (session) {
    if (!hasActiveRunCookie && pathname.startsWith('/staff/run')) {
      return NextResponse.next()
    }

    const { data: profile } = await supabase
      .from('user_profile')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle()

    const userRole = profile?.role

    for (const [prefix, allowedRoles] of Object.entries(roleRestrictedPrefixes)) {
      if (pathname.startsWith(prefix) && userRole && !allowedRoles.includes(userRole as any)) {
        switch (userRole) {
          case 'admin':
            return NextResponse.redirect(new URL('/admin', req.url))
          case 'staff':
            return NextResponse.redirect(new URL('/staff', req.url))
          case 'client':
            return NextResponse.redirect(new URL('/client', req.url))
          default:
            return NextResponse.redirect(new URL('/auth/sign-in', req.url))
        }
      }
    }
  } else if (hasActiveRunCookie) {
    res.cookies.delete(ACTIVE_RUN_COOKIE_NAME)
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
