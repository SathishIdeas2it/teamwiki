// Mock next-auth before importing middleware so Jest doesn't attempt to parse
// the ESM-only next-auth package in the jsdom test environment.
jest.mock('@/lib/auth/config', () => ({
  auth: (handler: unknown) => handler,
}));
jest.mock('next/server', () => ({
  NextResponse: {
    next: jest.fn(() => ({ type: 'next' })),
    redirect: jest.fn((url: string) => ({ type: 'redirect', url })),
  },
}));

import { routeDecision, isPublicPath, isAdminPath } from '@/middleware';

// routeDecision is a pure function — no Next.js or NextAuth involvement required.

type Session = { user?: { role?: string } } | null;

const BASE_URL = 'http://localhost:3000';

// ─── isPublicPath ─────────────────────────────────────────────────────────────

describe('isPublicPath', () => {
  it.each(['/login', '/register', '/api/auth', '/api/auth/session'])(
    'returns true for public path %s',
    (path) => expect(isPublicPath(path)).toBe(true),
  );

  it.each(['/articles', '/search', '/tags', '/admin', '/api/articles'])(
    'returns false for protected path %s',
    (path) => expect(isPublicPath(path)).toBe(false),
  );
});

// ─── isAdminPath ─────────────────────────────────────────────────────────────

describe('isAdminPath', () => {
  it.each(['/admin', '/admin/users', '/admin/users/some-id', '/api/users', '/api/users/123'])(
    'returns true for admin path %s',
    (path) => expect(isAdminPath(path)).toBe(true),
  );

  it.each(['/articles', '/search', '/api/articles', '/api/tags'])(
    'returns false for non-admin path %s',
    (path) => expect(isAdminPath(path)).toBe(false),
  );
});

// ─── routeDecision ───────────────────────────────────────────────────────────

describe('routeDecision', () => {
  describe('public paths', () => {
    it('passes through unauthenticated requests to /login', () => {
      const decision = routeDecision('/login', null, BASE_URL);
      expect(decision.action).toBe('next');
    });

    it('passes through unauthenticated requests to /register', () => {
      const decision = routeDecision('/register', null, BASE_URL);
      expect(decision.action).toBe('next');
    });

    it('passes through unauthenticated requests to /api/auth/*', () => {
      const decision = routeDecision('/api/auth/session', null, BASE_URL);
      expect(decision.action).toBe('next');
    });

    it('redirects authenticated users away from /login to /articles', () => {
      const session: Session = { user: { role: 'VIEWER' } };
      const decision = routeDecision('/login', session, BASE_URL);
      expect(decision.action).toBe('redirect');
      if (decision.action === 'redirect') {
        expect(decision.to).toContain('/articles');
      }
    });

    it('redirects authenticated users away from /register to /articles', () => {
      const session: Session = { user: { role: 'EDITOR' } };
      const decision = routeDecision('/register', session, BASE_URL);
      expect(decision.action).toBe('redirect');
      if (decision.action === 'redirect') {
        expect(decision.to).toContain('/articles');
      }
    });

    it('does NOT redirect authenticated users from /api/auth/* paths', () => {
      const session: Session = { user: { role: 'ADMIN' } };
      const decision = routeDecision('/api/auth/session', session, BASE_URL);
      expect(decision.action).toBe('next');
    });
  });

  describe('unauthenticated access to protected paths', () => {
    it('redirects to /login when session is null', () => {
      const decision = routeDecision('/articles', null, BASE_URL);
      expect(decision.action).toBe('redirect');
      if (decision.action === 'redirect') {
        expect(decision.to).toContain('/login');
      }
    });

    it('includes callbackUrl in the redirect URL', () => {
      const decision = routeDecision('/articles/my-slug', null, BASE_URL);
      expect(decision.action).toBe('redirect');
      if (decision.action === 'redirect') {
        expect(decision.to).toContain('callbackUrl');
        expect(decision.to).toContain(encodeURIComponent('/articles/my-slug'));
      }
    });

    it('redirects unauthenticated admin path to /login', () => {
      const decision = routeDecision('/admin', null, BASE_URL);
      expect(decision.action).toBe('redirect');
      if (decision.action === 'redirect') {
        expect(decision.to).toContain('/login');
      }
    });
  });

  describe('role-based access to admin paths', () => {
    it('allows ADMIN to access /admin', () => {
      const session: Session = { user: { role: 'ADMIN' } };
      const decision = routeDecision('/admin', session, BASE_URL);
      expect(decision.action).toBe('next');
    });

    it('allows ADMIN to access /admin/users', () => {
      const session: Session = { user: { role: 'ADMIN' } };
      const decision = routeDecision('/admin/users', session, BASE_URL);
      expect(decision.action).toBe('next');
    });

    it('allows ADMIN to access /api/users', () => {
      const session: Session = { user: { role: 'ADMIN' } };
      const decision = routeDecision('/api/users', session, BASE_URL);
      expect(decision.action).toBe('next');
    });

    it('redirects EDITOR from /admin to /403', () => {
      const session: Session = { user: { role: 'EDITOR' } };
      const decision = routeDecision('/admin', session, BASE_URL);
      expect(decision.action).toBe('redirect');
      if (decision.action === 'redirect') {
        expect(decision.to).toContain('/403');
      }
    });

    it('redirects VIEWER from /admin to /403', () => {
      const session: Session = { user: { role: 'VIEWER' } };
      const decision = routeDecision('/admin', session, BASE_URL);
      expect(decision.action).toBe('redirect');
      if (decision.action === 'redirect') {
        expect(decision.to).toContain('/403');
      }
    });

    it('redirects EDITOR from /api/users to /403', () => {
      const session: Session = { user: { role: 'EDITOR' } };
      const decision = routeDecision('/api/users', session, BASE_URL);
      expect(decision.action).toBe('redirect');
      if (decision.action === 'redirect') {
        expect(decision.to).toContain('/403');
      }
    });
  });

  describe('authenticated access to general protected paths', () => {
    it('passes VIEWER through to /articles', () => {
      const session: Session = { user: { role: 'VIEWER' } };
      expect(routeDecision('/articles', session, BASE_URL).action).toBe('next');
    });

    it('passes EDITOR through to /articles/new', () => {
      const session: Session = { user: { role: 'EDITOR' } };
      expect(routeDecision('/articles/new', session, BASE_URL).action).toBe('next');
    });

    it('passes VIEWER through to /search', () => {
      const session: Session = { user: { role: 'VIEWER' } };
      expect(routeDecision('/search', session, BASE_URL).action).toBe('next');
    });

    it('passes ADMIN through to /tags', () => {
      const session: Session = { user: { role: 'ADMIN' } };
      expect(routeDecision('/tags', session, BASE_URL).action).toBe('next');
    });
  });
});
