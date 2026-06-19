import { PrismaClient, Role } from '@prisma/client';

const testDatabaseUrl = process.env['DATABASE_URL_TEST'];
if (!testDatabaseUrl) {
  throw new Error('DATABASE_URL_TEST must be set to run integration tests');
}

export const prisma = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});

export async function resetDatabase(): Promise<void> {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.articleRevision.deleteMany(),
    prisma.articleTag.deleteMany(),
    prisma.article.deleteMany(),
    prisma.tag.deleteMany(),
    prisma.category.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.user.deleteMany({ where: { role: { not: Role.SYSTEM } } }),
  ]);
}

export async function createTestUser(
  overrides: Partial<{
    email: string;
    name: string;
    role: Role;
    isActive: boolean;
    passwordHash: string;
  }> = {},
): Promise<{ id: string; email: string; name: string; role: Role }> {
  return prisma.user.create({
    data: {
      email: overrides.email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      name: overrides.name ?? 'Test User',
      role: overrides.role ?? Role.VIEWER,
      isActive: overrides.isActive ?? true,
      passwordHash: overrides.passwordHash,
    },
    select: { id: true, email: true, name: true, role: true },
  });
}
