import { z } from 'zod';

const configSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  IMPORT_DIR: z.string().min(1),
  IMPORT_POLL_INTERVAL_MS: z.coerce.number().int().min(10000).default(60000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid environment configuration. Missing or invalid: ${missing}`);
  }
  return result.data;
}

export const config: Config = loadConfig();
