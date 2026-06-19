import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

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
  const user = await prisma.user.create({
    data: {
      email: overrides.email ?? `test-${Date.now()}@example.com`,
      name: overrides.name ?? 'Test User',
      role: overrides.role ?? Role.VIEWER,
      isActive: overrides.isActive ?? true,
      passwordHash: overrides.passwordHash,
    },
    select: { id: true, email: true, name: true, role: true },
  });
  return user;
}

export { prisma };
