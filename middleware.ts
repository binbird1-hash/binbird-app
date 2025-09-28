// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { ACTIVE_RUN_COOKIE_NAME } from '@/lib/active-run-cookie'

type ClientListRow = {
  id: string
  account_id: string | null
  client_name: string | null
  company: string | null
}

const deriveAccountId = (row: ClientListRow): string =>
  row.account_id?.trim() || row.client_name?.trim() || row.company?.trim() || row.id

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
    if (hasActiveRunCookie && activeRunBlockedPaths.has(normalizedPathname)) {
      return NextResponse.redirect(new URL('/staff/route', req.url))
    }

    if (!hasActiveRunCookie && signedInRestrictedPaths.has(normalizedPathname)) {
      return NextResponse.redirect(new URL('/staff/run', req.url))
    }

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

  if (!session && hasActiveRunCookie) {
    res.cookies.delete(ACTIVE_RUN_COOKIE_NAME)
  }

  const fetchClientRowsForToken = async (accountId: string): Promise<ClientListRow[]> => {
    const selectColumns = 'id, account_id, client_name, company'
    const deduped = new Map<string, ClientListRow>()
    const queryColumns: Array<keyof ClientListRow> = [
      'account_id',
      'id',
      'client_name',
      'company',
    ]

    for (const column of queryColumns) {
      const { data, error } = await supabase
        .from('client_list')
        .select(selectColumns)
        .eq(column as string, accountId)

      if (error) {
        console.warn(`Failed to query client_list by ${column}`, error)
        continue
      }

      if (data?.length) {
        data.forEach((row) => deduped.set(row.id, row as ClientListRow))
        break
      }
    }

    if (!deduped.size) {
      const { data, error } = await supabase
        .from('client_list')
        .select(selectColumns)

      if (error) {
        console.warn('Failed to fetch client_list for token fallback', error)
        return []
      }

      data?.forEach((row) => {
        const typed = row as ClientListRow
        if (deriveAccountId(typed) === accountId) {
          deduped.set(typed.id, typed)
        }
      })
    }

    return Array.from(deduped.values())
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

      const rows = await fetchClientRowsForToken(decodedToken)
      const hasMatch = rows.some((row) => deriveAccountId(row) === decodedToken)

      if (!hasMatch) {
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
