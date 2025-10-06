// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { ACTIVE_RUN_COOKIE_NAME } from '@/lib/active-run-cookie'
import { resolvePortalScope } from '@/lib/clientPortalAccess'

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

  const normalizedPathname =
    pathname !== '/' && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname

  const hasActiveRunCookie = req.cookies.get(ACTIVE_RUN_COOKIE_NAME)?.value === 'true'

  const signedInRestrictedPaths = new Set([
    '/',
    '/auth',
    '/auth/sign-in',
    '/auth/sign-up',
  ])

  const activeRunBlockedPaths = new Set([
    ...signedInRestrictedPaths,
    '/staff/run',
  ])

  // Staff & Ops routes → require login
  if (!session && (pathname.startsWith('/staff') || pathname.startsWith('/ops'))) {
    const redirect = NextResponse.redirect(new URL('/auth', req.url))
    if (hasActiveRunCookie) {
      redirect.cookies.delete(ACTIVE_RUN_COOKIE_NAME)
    }
    return redirect
  }

  if (session) {
    const { data: role, error } = await supabase.rpc<string>('get_my_role')
    const hasStaffAccess = !error && (role === 'staff' || role === 'admin')
    const defaultSignedInRedirect = hasStaffAccess ? '/staff/run' : '/'

    if (hasActiveRunCookie && hasStaffAccess && activeRunBlockedPaths.has(normalizedPathname)) {
      return NextResponse.redirect(new URL('/staff/route', req.url))
    }

    if (
      !hasActiveRunCookie &&
      signedInRestrictedPaths.has(normalizedPathname) &&
      normalizedPathname !== defaultSignedInRedirect
    ) {
      return NextResponse.redirect(new URL(defaultSignedInRedirect, req.url))
    }

    if (!error) {
      if (pathname.startsWith('/staff') && !hasStaffAccess) {
        return NextResponse.redirect(new URL('/', req.url))
      }
      if (pathname.startsWith('/ops') && role !== 'admin') {
        return NextResponse.redirect(new URL('/', req.url))
      }
    }
  }

  if (!session && hasActiveRunCookie) {
    res.cookies.delete(ACTIVE_RUN_COOKIE_NAME)
  }

  // Check client portal tokens
  if (pathname.startsWith('/c/') && !pathname.startsWith('/c/error')) {
    const token = pathname.split('/c/')[1]
    if (token) {
      let decodedToken = token
      try {
        decodedToken = decodeURIComponent(token).trim()
      } catch (error) {
        console.warn('Failed to decode client portal token', error)
        return NextResponse.redirect(new URL('/c/error', req.url))
      }

      if (!decodedToken) {
        return NextResponse.redirect(new URL('/c/error', req.url))
      }

      const scope = await resolvePortalScope(supabase, decodedToken)

      if (!scope) {
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
