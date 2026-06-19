import type { Role } from '@prisma/client';
import type { AppSession } from '@/types';

export type Permission =
  | 'article:read'
  | 'article:create'
  | 'article:edit:own'
  | 'article:edit:any'
  | 'article:delete'
  | 'admin:access'
  | 'user:manage';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  VIEWER: ['article:read'],
  EDITOR: ['article:read', 'article:create', 'article:edit:own'],
  ADMIN: [
    'article:read',
    'article:create',
    'article:edit:own',
    'article:edit:any',
    'article:delete',
    'admin:access',
    'user:manage',
  ],
  SYSTEM: ['article:read', 'article:create'],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canEditArticle(
  session: AppSession,
  article: { authorId: string },
): boolean {
  return (
    hasPermission(session.user.role, 'article:edit:any') ||
    (hasPermission(session.user.role, 'article:edit:own') &&
      article.authorId === session.user.id)
  );
}

export function requirePermission(session: AppSession, permission: Permission): void {
  if (!hasPermission(session.user.role, permission)) {
    throw new Error(`Permission denied: ${permission}`);
  }
}

export function isAdmin(session: AppSession): boolean {
  return session.user.role === 'ADMIN';
}
