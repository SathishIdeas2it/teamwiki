import { prisma, resetDatabase } from './helpers/db';

// Point DATABASE_URL at the test database before any service module is loaded.
// src/lib/db/client.ts reads DATABASE_URL when the PrismaClient singleton is first
// constructed. Because setupFilesAfterEnv runs before the test file's imports are
// resolved, the singleton will be created with the correct URL.
const testUrl = process.env['DATABASE_URL_TEST'];
if (testUrl) {
  process.env['DATABASE_URL'] = testUrl;
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
