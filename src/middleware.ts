import { auth } from '@/lib/auth/config';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/api/auth'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith('/admin') || pathname.startsWith('/api/users');
}

export default auth(function middleware(req: NextRequest & { auth: unknown }) {
  const { pathname } = req.nextUrl;
  const session = (req as unknown as { auth: { user?: { role?: string } } | null }).auth;

  if (isPublicPath(pathname)) {
    if (session && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/articles', req.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminPath(pathname) && session.user?.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/403', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
};
