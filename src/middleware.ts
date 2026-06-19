import { auth } from '@/lib/auth/config';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/api/auth'];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export function isAdminPath(pathname: string): boolean {
  return pathname.startsWith('/admin') || pathname.startsWith('/api/users');
}

type MiddlewareSession = { user?: { role?: string } } | null;

export type RouteDecision =
  | { action: 'next' }
  | { action: 'redirect'; to: string };

export function routeDecision(
  pathname: string,
  session: MiddlewareSession,
  baseUrl: string,
): RouteDecision {
  if (isPublicPath(pathname)) {
    // Redirect authenticated users away from login/register pages
    if (session && (pathname === '/login' || pathname === '/register')) {
      return { action: 'redirect', to: new URL('/articles', baseUrl).href };
    }
    return { action: 'next' };
  }

  if (!session) {
    const loginUrl = new URL('/login', baseUrl);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return { action: 'redirect', to: loginUrl.href };
  }

  if (isAdminPath(pathname) && session.user?.role !== 'ADMIN') {
    return { action: 'redirect', to: new URL('/403', baseUrl).href };
  }

  return { action: 'next' };
}

export default auth(function middleware(req: NextRequest) {
  const session = (req as unknown as { auth: MiddlewareSession }).auth;
  const decision = routeDecision(req.nextUrl.pathname, session, req.url);
  if (decision.action === 'redirect') {
    return NextResponse.redirect(decision.to);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
};
