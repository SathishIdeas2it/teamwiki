import { execSync } from 'child_process';

export default async function globalSetup(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL_TEST'];
  if (!databaseUrl) {
    throw new Error('DATABASE_URL_TEST environment variable is required for integration tests');
  }

  process.env['DATABASE_URL'] = databaseUrl;

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  console.log('Integration test database migrated successfully');
}
