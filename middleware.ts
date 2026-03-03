import { NextResponse, type NextRequest } from 'next/server'

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check for the Supabase session cookie to determine authentication state.
  // This avoids importing @supabase/ssr which uses Node.js APIs incompatible
  // with Vercel's edge runtime.
  const sessionCookie = request.cookies.get('sb-ajbmfilnfnzrlbnbleik-auth-token')
  const isAuthenticated = !!sessionCookie?.value

  const isAuthPage = pathname === '/login' || pathname === '/signup'
  const isPublicPage = isAuthPage || pathname === '/onboarding'

  if (isAuthenticated && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (!isAuthenticated && !isPublicPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}
