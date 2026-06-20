import { getDashboardStats } from '@/lib/services/admin';
import { prismaMock } from '../../setup';
import { ForbiddenError } from '@/lib/errors';
import type { AppSession } from '@/types';

const ADMIN_SESSION: AppSession = {
  user: { id: 'u-admin', email: 'admin@test.com', name: 'Admin', role: 'ADMIN' },
  expires: '2099-01-01',
};

const VIEWER_SESSION: AppSession = {
  user: { id: 'u-viewer', email: 'viewer@test.com', name: 'Viewer', role: 'VIEWER' },
  expires: '2099-01-01',
};

const EDITOR_SESSION: AppSession = {
  user: { id: 'u-editor', email: 'editor@test.com', name: 'Editor', role: 'EDITOR' },
  expires: '2099-01-01',
};

describe('getDashboardStats', () => {
  beforeEach(() => {
    prismaMock.article.count.mockResolvedValue(0);
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.auditLog.count.mockResolvedValue(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prismaMock.user.groupBy as any).mockResolvedValue([]);
  });

  it('throws ForbiddenError for VIEWER role', async () => {
    await expect(getDashboardStats(VIEWER_SESSION)).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError for EDITOR role', async () => {
    await expect(getDashboardStats(EDITOR_SESSION)).rejects.toThrow(ForbiddenError);
  });

  it('returns correct article counts', async () => {
    prismaMock.article.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);

    const stats = await getDashboardStats(ADMIN_SESSION);

    expect(stats.totalArticles).toBe(10);
    expect(stats.publishedArticles).toBe(7);
    expect(stats.draftArticles).toBe(3);
    expect(stats.articlesThisMonth).toBe(2);
  });

  it('returns correct user count', async () => {
    prismaMock.user.count.mockResolvedValue(15);

    const stats = await getDashboardStats(ADMIN_SESSION);

    expect(stats.totalUsers).toBe(15);
  });

  it('returns correct recent imports count', async () => {
    prismaMock.auditLog.count.mockResolvedValue(5);

    const stats = await getDashboardStats(ADMIN_SESSION);

    expect(stats.recentImports).toBe(5);
  });

  it('maps role group counts into usersByRole', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prismaMock.user.groupBy as any).mockResolvedValue([
      { role: 'ADMIN', _count: { id: 1 } },
      { role: 'EDITOR', _count: { id: 3 } },
      { role: 'VIEWER', _count: { id: 10 } },
    ]);

    const stats = await getDashboardStats(ADMIN_SESSION);

    expect(stats.usersByRole.ADMIN).toBe(1);
    expect(stats.usersByRole.EDITOR).toBe(3);
    expect(stats.usersByRole.VIEWER).toBe(10);
  });

  it('initialises missing roles to 0 in usersByRole', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prismaMock.user.groupBy as any).mockResolvedValue([
      { role: 'ADMIN', _count: { id: 2 } },
    ]);

    const stats = await getDashboardStats(ADMIN_SESSION);

    expect(stats.usersByRole.VIEWER).toBe(0);
    expect(stats.usersByRole.EDITOR).toBe(0);
    expect(stats.usersByRole.SYSTEM).toBe(0);
  });
});
