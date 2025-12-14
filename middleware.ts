// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { ACTIVE_RUN_COOKIE_NAME } from '@/lib/active-run-cookie'
import { resolvePortalScope } from '@/lib/clientPortalAccess'
import { normalizePortalRole, resolvePortalRoleFromUser } from '@/lib/portalRoles'

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  // ✅ Allow Next.js internals through
  if (pathname.startsWith('/_next/')) {
    return NextResponse.next()
  }

  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // ✅ Get Supabase session
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

  const staffAuthPaths = new Set(['/auth/login', '/auth/sign-up', '/staff/login', '/staff/sign-up'])

  // ✅ Require login for protected routes
  if (!session && (pathname.startsWith('/staff') || pathname.startsWith('/ops') || pathname.startsWith('/admin'))) {
    const isStaffAuthRoute = staffAuthPaths.has(normalizedPathname)
    if (!isStaffAuthRoute) {
      const redirect = NextResponse.redirect(new URL('/auth/login', req.url))
      if (hasActiveRunCookie) redirect.cookies.delete(ACTIVE_RUN_COOKIE_NAME)
      return redirect
    }
  }

  // =====================================================
  // 🧩 ROLE DETECTION SECTION
  // =====================================================
  let role: ReturnType<typeof normalizePortalRole> = resolvePortalRoleFromUser(
    session?.user ?? null,
  )

  if (session) {
    // 🧠 Try to get role from RPC if not in metadata
    if (!role) {
      const { data, error } = await supabase.rpc('get_my_role')
      console.log('🧩 RPC get_my_role result:', { data, error })

      if (error) {
        console.error('Error fetching role from RPC:', error.message)
      } else if (data) {
        role = normalizePortalRole(data)
      }
    }

    // 🧱 Fallback: direct query from user_profile
    if (!role) {
      const { data: profile, error: profileError } = await supabase
        .from('user_profile')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (profileError) console.error('Profile fallback error:', profileError.message)
      role = normalizePortalRole(profile?.role)
    }

    console.log('🧠 Final resolved role:', role)

    // ✅ Fix: redirect admin correctly after login
    if (role === 'admin' && normalizedPathname === '/auth/login') {
      return NextResponse.redirect(new URL('/admin', req.url))
    }

    // 🏃 Active run cookie logic
    if (hasActiveRunCookie && activeRunBlockedPaths.has(normalizedPathname)) {
      if (role === 'staff' || role === 'admin') {
        return NextResponse.redirect(new URL('/staff/route', req.url))
      }

      const redirect = NextResponse.redirect(new URL('/client/dashboard', req.url))
      redirect.cookies.delete(ACTIVE_RUN_COOKIE_NAME)
      return redirect
    }

    // 🚪 Redirect signed-in users away from login/signup
    if (!hasActiveRunCookie && signedInRestrictedPaths.has(normalizedPathname)) {
      const destination =
        role === 'admin'
          ? '/admin'
          : role === 'staff'
            ? '/staff/run'
            : '/client/dashboard'
      return NextResponse.redirect(new URL(destination, req.url))
    }

    // 🧱 Role-based route access
    if (role) {
      if (pathname.startsWith('/staff') && role !== 'staff' && role !== 'admin') {
        return NextResponse.redirect(new URL('/', req.url))
      }
      if (pathname.startsWith('/ops') && role !== 'admin') {
        return NextResponse.redirect(new URL('/', req.url))
      }
      if (pathname.startsWith('/admin') && role !== 'admin') {
        return NextResponse.redirect(new URL('/', req.url))
      }
    }
  }

  if (!session && hasActiveRunCookie) {
    res.cookies.delete(ACTIVE_RUN_COOKIE_NAME)
  }

  // =====================================================
  // 💬 Client portal token check
  // =====================================================
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
