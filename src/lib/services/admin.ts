import { Role } from '@prisma/client';
import { db } from '@/lib/db/client';
import { requirePermission } from '@/lib/auth/permissions';
import type { AppSession, DashboardStats } from '@/types';

export async function getDashboardStats(session: AppSession): Promise<DashboardStats> {
  requirePermission(session, 'admin:access');

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalArticles,
    publishedArticles,
    draftArticles,
    totalUsers,
    articlesThisMonth,
    recentImports,
    roleGroups,
  ] = await Promise.all([
    db.article.count({ where: { deletedAt: null } }),
    db.article.count({ where: { deletedAt: null, status: 'PUBLISHED' } }),
    db.article.count({ where: { deletedAt: null, status: 'DRAFT' } }),
    db.user.count({ where: { deletedAt: null } }),
    db.article.count({ where: { deletedAt: null, createdAt: { gte: monthStart } } }),
    db.auditLog.count({
      where: { eventType: 'MCP_IMPORT_SUCCESS', createdAt: { gte: thirtyDaysAgo } },
    }),
    db.user.groupBy({
      by: ['role'],
      where: { deletedAt: null },
      _count: { id: true },
    }),
  ]);

  const usersByRole: Record<Role, number> = {
    VIEWER: 0,
    EDITOR: 0,
    ADMIN: 0,
    SYSTEM: 0,
  };

  for (const group of roleGroups as Array<{ role: Role; _count: { id: number } }>) {
    usersByRole[group.role] = group._count.id;
  }

  return {
    totalArticles,
    publishedArticles,
    draftArticles,
    totalUsers,
    usersByRole,
    articlesThisMonth,
    recentImports,
  };
}
