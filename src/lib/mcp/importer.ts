import path from 'path';
import { getMcpClient } from '@/lib/mcp/client';
import { logger } from '@/lib/logger';
import type { McpFileMetadata } from '@/types';

const ALLOWED_EXTENSIONS = new Set(['.md', '.txt', '.markdown']);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const SYSTEM_SESSION = {
  user: {
    id: process.env['SYSTEM_USER_ID'] ?? 'system',
    email: 'system@teamwiki.internal',
    name: 'System',
    role: 'SYSTEM' as const,
  },
  expires: new Date(Date.now() + 86400000).toISOString(),
};

export async function runImportPipeline(filePath: string): Promise<void> {
  const client = getMcpClient();

  let metadata: McpFileMetadata;
  let content: string;

  try {
    const result = await client.readFile(filePath);
    metadata = result.metadata;
    content = result.content;
  } catch (err) {
    logger.error({ err, filePath }, 'MCP: failed to read file');
    return;
  }

  const ext = path.extname(metadata.name).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    logger.warn({ filePath, ext }, 'MCP: rejected file — unsupported extension');
    await moveToFailed(client, filePath, metadata, 'unsupported extension');
    return;
  }

  if (metadata.sizeBytes > MAX_FILE_SIZE_BYTES) {
    logger.warn({ filePath, sizeBytes: metadata.sizeBytes }, 'MCP: rejected file — too large');
    await moveToFailed(client, filePath, metadata, 'file too large');
    return;
  }

  try {
    const title = path.basename(metadata.name, ext).replace(/-/g, ' ');

    const { createFromImport } = await import('@/lib/services/articles');
    await createFromImport({ title, content }, SYSTEM_SESSION);

    logger.info({ filePath, title }, 'MCP: import successful');
  } catch (err) {
    logger.error({ err, filePath }, 'MCP: import pipeline failed');
    await moveToFailed(client, filePath, metadata, String(err));
  }
}

async function moveToFailed(
  client: Awaited<ReturnType<typeof getMcpClient>>,
  filePath: string,
  metadata: McpFileMetadata,
  reason: string,
): Promise<void> {
  try {
    const failedPath = path.join(path.dirname(filePath), 'failed', metadata.name);
    await client.moveFile(filePath, failedPath);
    logger.info({ filePath, failedPath, reason }, 'MCP: file moved to failed/');
  } catch (err) {
    logger.error({ err, filePath }, 'MCP: failed to move file to failed/');
  }
}

export function startImportPoller(): void {
  const intervalMs = Number(process.env['IMPORT_POLL_INTERVAL_MS'] ?? 60000);

  logger.info({ intervalMs }, 'MCP: import poller started');

  setInterval(async () => {
    try {
      const client = getMcpClient();
      const files = await client.listFiles();

      for (const file of files) {
        await runImportPipeline(file.path);
      }
    } catch (err) {
      logger.error({ err }, 'MCP: polling cycle failed');
    }
  }, intervalMs);
}
