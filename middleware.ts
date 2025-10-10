import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

type UserRole = 'staff' | 'client' | 'admin'

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/images') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.webp')
  )
}

function resolvePortalDestination(role: UserRole | null) {
  if (role === 'staff' || role === 'admin') {
    return '/staff/dashboard'
  }

  if (role === 'client') {
    return '/client/dashboard'
  }

  return '/auth/unauthorized'
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const isAuthRoute = pathname.startsWith('/auth')
  const isStaffRoute = pathname.startsWith('/staff')
  const isClientRoute = pathname.startsWith('/client')
  const isProtectedRoute = isStaffRoute || isClientRoute

  if (!session) {
    if (isProtectedRoute) {
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/auth/sign-in'
      redirectUrl.searchParams.set('redirectedFrom', pathname)
      return NextResponse.redirect(redirectUrl)
    }

    return res
  }

  let role: UserRole | null = null

  const { data: profile, error: profileError } = await supabase
    .from('user_profile')
    .select('role')
    .eq('user_id', session.user.id)
    .maybeSingle()

  if (!profileError) {
    const rawRole = typeof profile?.role === 'string' ? profile.role.trim().toLowerCase() : null

    if (rawRole === 'staff' || rawRole === 'admin' || rawRole === 'client') {
      role = rawRole
    }
  }

  const destination = resolvePortalDestination(role)

  if (
    isAuthRoute &&
    !pathname.startsWith('/auth/unauthorized') &&
    !pathname.startsWith('/auth/callback') &&
    !pathname.startsWith('/auth/reset')
  ) {
    return NextResponse.redirect(new URL(destination, req.url))
  }

  if (isStaffRoute && role !== 'staff' && role !== 'admin') {
    return NextResponse.redirect(new URL('/auth/unauthorized', req.url))
  }

  if (isClientRoute && role !== 'client') {
    return NextResponse.redirect(new URL('/auth/unauthorized', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
