import {
  hasPermission,
  canEditArticle,
  requirePermission,
  isAdmin,
  type Permission,
} from '@/lib/auth/permissions';
import { ForbiddenError } from '@/lib/errors';
import type { AppSession } from '@/types';

function makeSession(
  role: 'VIEWER' | 'EDITOR' | 'ADMIN' | 'SYSTEM',
  id = 'user-1',
): AppSession {
  return {
    user: { id, email: 'test@example.com', name: 'Test User', role },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

// ─── hasPermission ────────────────────────────────────────────────────────────

describe('hasPermission', () => {
  describe('VIEWER', () => {
    it('can read articles', () => expect(hasPermission('VIEWER', 'article:read')).toBe(true));
    it('cannot create articles', () => expect(hasPermission('VIEWER', 'article:create')).toBe(false));
    it('cannot edit own articles', () => expect(hasPermission('VIEWER', 'article:edit:own')).toBe(false));
    it('cannot edit any articles', () => expect(hasPermission('VIEWER', 'article:edit:any')).toBe(false));
    it('cannot delete articles', () => expect(hasPermission('VIEWER', 'article:delete')).toBe(false));
    it('cannot access admin panel', () => expect(hasPermission('VIEWER', 'admin:access')).toBe(false));
    it('cannot manage users', () => expect(hasPermission('VIEWER', 'user:manage')).toBe(false));
  });

  describe('EDITOR', () => {
    it('can read articles', () => expect(hasPermission('EDITOR', 'article:read')).toBe(true));
    it('can create articles', () => expect(hasPermission('EDITOR', 'article:create')).toBe(true));
    it('can edit own articles', () => expect(hasPermission('EDITOR', 'article:edit:own')).toBe(true));
    it('cannot edit any articles', () => expect(hasPermission('EDITOR', 'article:edit:any')).toBe(false));
    it('cannot delete articles', () => expect(hasPermission('EDITOR', 'article:delete')).toBe(false));
    it('cannot access admin panel', () => expect(hasPermission('EDITOR', 'admin:access')).toBe(false));
    it('cannot manage users', () => expect(hasPermission('EDITOR', 'user:manage')).toBe(false));
  });

  describe('ADMIN', () => {
    const permissions: Permission[] = [
      'article:read',
      'article:create',
      'article:edit:own',
      'article:edit:any',
      'article:delete',
      'admin:access',
      'user:manage',
    ];
    it.each(permissions)('has permission %s', (p) =>
      expect(hasPermission('ADMIN', p)).toBe(true),
    );
  });

  describe('SYSTEM', () => {
    it('can read articles', () => expect(hasPermission('SYSTEM', 'article:read')).toBe(true));
    it('can create articles', () => expect(hasPermission('SYSTEM', 'article:create')).toBe(true));
    it('cannot edit any articles', () => expect(hasPermission('SYSTEM', 'article:edit:any')).toBe(false));
    it('cannot access admin panel', () => expect(hasPermission('SYSTEM', 'admin:access')).toBe(false));
    it('cannot manage users', () => expect(hasPermission('SYSTEM', 'user:manage')).toBe(false));
  });
});

// ─── canEditArticle ───────────────────────────────────────────────────────────

describe('canEditArticle', () => {
  it('EDITOR can edit their own article', () => {
    const session = makeSession('EDITOR', 'author-id');
    expect(canEditArticle(session, { authorId: 'author-id' })).toBe(true);
  });

  it('EDITOR cannot edit another user\'s article', () => {
    const session = makeSession('EDITOR', 'editor-id');
    expect(canEditArticle(session, { authorId: 'other-id' })).toBe(false);
  });

  it('ADMIN can edit any article', () => {
    const session = makeSession('ADMIN', 'admin-id');
    expect(canEditArticle(session, { authorId: 'someone-else' })).toBe(true);
  });

  it('ADMIN can edit their own article', () => {
    const session = makeSession('ADMIN', 'admin-id');
    expect(canEditArticle(session, { authorId: 'admin-id' })).toBe(true);
  });

  it('VIEWER cannot edit any article', () => {
    const session = makeSession('VIEWER', 'viewer-id');
    expect(canEditArticle(session, { authorId: 'viewer-id' })).toBe(false);
  });

  it('VIEWER cannot edit another user\'s article', () => {
    const session = makeSession('VIEWER', 'viewer-id');
    expect(canEditArticle(session, { authorId: 'other-id' })).toBe(false);
  });
});

// ─── requirePermission ────────────────────────────────────────────────────────

describe('requirePermission', () => {
  it('does not throw when the role has the permission', () => {
    const session = makeSession('EDITOR');
    expect(() => requirePermission(session, 'article:create')).not.toThrow();
  });

  it('throws ForbiddenError when the role lacks the permission', () => {
    const session = makeSession('VIEWER');
    expect(() => requirePermission(session, 'article:create')).toThrow(ForbiddenError);
  });

  it('throws ForbiddenError (not a generic Error) so route handlers map it to 403', () => {
    const session = makeSession('VIEWER');
    try {
      requirePermission(session, 'admin:access');
      fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).statusCode).toBe(403);
    }
  });

  it('throws ForbiddenError for EDITOR trying admin:access', () => {
    const session = makeSession('EDITOR');
    expect(() => requirePermission(session, 'admin:access')).toThrow(ForbiddenError);
  });

  it('does not throw for ADMIN on any permission', () => {
    const session = makeSession('ADMIN');
    const permissions: Permission[] = [
      'article:read',
      'article:create',
      'article:edit:any',
      'article:delete',
      'admin:access',
      'user:manage',
    ];
    permissions.forEach((p) => {
      expect(() => requirePermission(session, p)).not.toThrow();
    });
  });
});

// ─── isAdmin ─────────────────────────────────────────────────────────────────

describe('isAdmin', () => {
  it('returns true for ADMIN role', () => expect(isAdmin(makeSession('ADMIN'))).toBe(true));
  it('returns false for EDITOR role', () => expect(isAdmin(makeSession('EDITOR'))).toBe(false));
  it('returns false for VIEWER role', () => expect(isAdmin(makeSession('VIEWER'))).toBe(false));
  it('returns false for SYSTEM role', () => expect(isAdmin(makeSession('SYSTEM'))).toBe(false));
});
