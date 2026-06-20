import path from 'path';
import { AuditEventType } from '@prisma/client';
import { getMcpClient } from '@/lib/mcp/client';
import { db } from '@/lib/db/client';
import { logger } from '@/lib/logger';
import { createFromImport } from '@/lib/services/articles';
import { logEvent } from '@/lib/services/audit';
import { slugify } from '@/lib/utils/slugify';
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

// ─── Frontmatter parsing ──────────────────────────────────────────────────────

function parseFrontmatter(rawContent: string): { tags: string[]; body: string } {
  const match = rawContent.match(/^---\n([\s\S]*?)\n---\n*/);
  if (!match || match[0] === undefined || match[1] === undefined) {
    return { tags: [], body: rawContent };
  }

  const yaml: string = match[1];
  const body = rawContent.slice(match[0].length);

  // Inline array: tags: [tag1, tag2, tag3]
  const inlineMatch = yaml.match(/^tags:\s*\[([^\]]*)\]/m);
  if (inlineMatch && inlineMatch[1] !== undefined) {
    const tagStr = inlineMatch[1].trim();
    if (!tagStr) return { tags: [], body };
    const tags = tagStr.split(',').map((t) => t.trim()).filter(Boolean);
    return { tags, body };
  }

  // Block list: tags:\n  - tag1\n  - tag2
  const blockMatch = yaml.match(/^tags:\n((?:[ \t]*-[ \t]+[^\n]+\n?)*)/m);
  if (blockMatch && blockMatch[1] !== undefined) {
    const tags = blockMatch[1]
      .split('\n')
      .map((line) => line.replace(/^[ \t]*-[ \t]+/, '').trim())
      .filter(Boolean);
    return { tags, body };
  }

  return { tags: [], body };
}

// ─── Tag resolution ───────────────────────────────────────────────────────────

async function resolveTagIds(tagNames: string[]): Promise<string[]> {
  const tagIds: string[] = [];

  for (const name of tagNames) {
    const slug = slugify(name);
    const existing = await db.tag.findUnique({ where: { slug }, select: { id: true } });

    if (existing) {
      tagIds.push(existing.id);
    } else {
      const created = await db.tag.create({
        data: { name, slug },
        select: { id: true },
      });
      tagIds.push(created.id);
    }
  }

  return tagIds;
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export async function runImportPipeline(
  filePath: string,
): Promise<'imported' | 'skipped' | 'failed'> {
  const client = getMcpClient();

  let metadata: McpFileMetadata;
  let content: string;

  try {
    const result = await client.readFile(filePath);
    metadata = result.metadata;
    content = result.content;
  } catch (err) {
    logger.error({ err, filePath }, 'MCP: failed to read file');
    return 'failed';
  }

  const ext = path.extname(metadata.name).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    logger.warn({ filePath, ext }, 'MCP: rejected file — unsupported extension');
    await moveToFailed(client, filePath, metadata, 'unsupported extension');
    return 'failed';
  }

  if (metadata.sizeBytes > MAX_FILE_SIZE_BYTES) {
    logger.warn({ filePath, sizeBytes: metadata.sizeBytes }, 'MCP: rejected file — too large');
    await moveToFailed(client, filePath, metadata, 'file too large');
    return 'failed';
  }

  // Deduplication: skip if fingerprint matches the most recent successful import
  const existingLog = await db.auditLog.findFirst({
    where: {
      eventType: AuditEventType.MCP_IMPORT_SUCCESS,
      metadata: { path: ['fileName'], equals: metadata.name },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existingLog) {
    const m = existingLog.metadata as Record<string, unknown> | null;
    if (
      m !== null &&
      m['fileName'] === metadata.name &&
      m['sizeBytes'] === metadata.sizeBytes &&
      m['mtime'] === metadata.mtime
    ) {
      logger.info({ filePath }, 'MCP: file already imported with matching fingerprint (skipped)');
      return 'skipped';
    }
  }

  try {
    const { tags: tagNames, body } = parseFrontmatter(content);
    const tagIds = await resolveTagIds(tagNames);
    const title = path.basename(metadata.name, ext).replace(/-/g, ' ');

    const article = await createFromImport({ title, content: body, tagIds }, SYSTEM_SESSION);

    await logEvent({
      eventType: AuditEventType.MCP_IMPORT_SUCCESS,
      actorId: SYSTEM_SESSION.user.id,
      targetId: article.id,
      targetType: 'article',
      metadata: {
        fileName: metadata.name,
        sizeBytes: metadata.sizeBytes,
        mtime: metadata.mtime,
        articleId: article.id,
      },
    });

    logger.info({ filePath, title }, 'MCP: import successful');
    return 'imported';
  } catch (err) {
    logger.error({ err, filePath }, 'MCP: import pipeline failed');
    await moveToFailed(client, filePath, metadata, String(err));
    return 'failed';
  }
}

async function moveToFailed(
  client: McpFilesystemClient,
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

// ─── Type alias for internal use ──────────────────────────────────────────────

type McpFilesystemClient = Awaited<ReturnType<typeof getMcpClient>>;
