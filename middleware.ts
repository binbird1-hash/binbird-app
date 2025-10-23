// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { ACTIVE_RUN_COOKIE_NAME } from '@/lib/active-run-cookie'
import { resolvePortalScope } from '@/lib/clientPortalAccess'
import {
  normalizePortalRole,
  resolveHighestPriorityRole,
  resolveRoleFromMetadata,
  type PortalRole,
} from '@/lib/roles'

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
    '/auth/login',
    '/auth/sign-in',
    '/auth/sign-up',
    '/client',
    '/client/login',
    '/staff',
    '/staff/login',
    '/staff/sign-up',
  ])

  const activeRunBlockedPaths = new Set([
    ...signedInRestrictedPaths,
    '/staff/run',
  ])

  // Staff & Ops routes → require login
  const staffAuthPaths = new Set(['/auth/login', '/auth/sign-up', '/staff/login', '/staff/sign-up'])

  if (!session && (pathname.startsWith('/staff') || pathname.startsWith('/ops') || pathname.startsWith('/admin'))) {
    const isStaffAuthRoute = staffAuthPaths.has(normalizedPathname)

    if (!isStaffAuthRoute) {
      const redirect = NextResponse.redirect(new URL('/auth/login', req.url))
      if (hasActiveRunCookie) {
        redirect.cookies.delete(ACTIVE_RUN_COOKIE_NAME)
      }
      return redirect
    }
  }

  let role: PortalRole = null

  if (session) {
    let rpcRole: PortalRole = null
    const { data, error } = await supabase.rpc('get_my_role')
    if (!error) {
      rpcRole = normalizePortalRole(data)
    }

    const appMetadataRole = resolveRoleFromMetadata(session.user?.app_metadata)
    const metadataRole = resolveRoleFromMetadata(session.user?.user_metadata)

    role = resolveHighestPriorityRole(rpcRole, appMetadataRole, metadataRole)

    if (hasActiveRunCookie && activeRunBlockedPaths.has(normalizedPathname)) {
      if (role === 'admin') {
        return NextResponse.redirect(new URL('/admin', req.url))
      }
      if (role === 'staff') {
        return NextResponse.redirect(new URL('/staff/route', req.url))
      }

      const redirect = NextResponse.redirect(new URL('/client/dashboard', req.url))
      redirect.cookies.delete(ACTIVE_RUN_COOKIE_NAME)
      return redirect
    }

    if (!hasActiveRunCookie && signedInRestrictedPaths.has(normalizedPathname) && role) {
      const destination =
        role === 'admin'
          ? '/admin'
          : role === 'staff'
            ? '/staff/run'
            : '/client/dashboard'
      return NextResponse.redirect(new URL(destination, req.url))
    }

    if (role) {
      if (pathname.startsWith('/staff') && role !== 'staff' && role !== 'admin') {
        return NextResponse.redirect(new URL('/', req.url))
      }
      if (pathname.startsWith('/admin') && role !== 'admin') {
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
