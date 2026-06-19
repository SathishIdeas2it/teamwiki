import { execSync } from 'child_process';
import { PrismaClient, Role } from '@prisma/client';

export default async function globalSetup(): Promise<void> {
  const testDatabaseUrl = process.env['DATABASE_URL_TEST'];
  if (!testDatabaseUrl) {
    throw new Error('DATABASE_URL_TEST environment variable is required for integration tests');
  }

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'inherit',
  });

  const prisma = new PrismaClient({
    datasources: { db: { url: testDatabaseUrl } },
  });

  try {
    await prisma.user.upsert({
      where: { email: 'system@teamwiki.internal' },
      update: {},
      create: {
        email: 'system@teamwiki.internal',
        name: 'System',
        role: Role.SYSTEM,
        isActive: true,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}
