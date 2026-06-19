import { prismaMock } from '../../setup';
import { AuditEventType } from '@prisma/client';

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// audit.ts does not exist yet — this import will fail (RED)
import { logEvent } from '@/lib/services/audit';
import { logger } from '@/lib/logger';

const mockLoggerError = logger.error as jest.Mock;

// ─── logEvent ────────────────────────────────────────────────────────────────

describe('logEvent', () => {
  it('creates an audit log entry with all provided fields', async () => {
    prismaMock.auditLog.create.mockResolvedValueOnce({} as never);

    await logEvent({
      eventType: AuditEventType.ARTICLE_CREATED,
      actorId: 'user-1',
      targetId: 'article-1',
      targetType: 'article',
      metadata: { slug: 'my-article', title: 'My Article' },
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        eventType: AuditEventType.ARTICLE_CREATED,
        actorId: 'user-1',
        targetId: 'article-1',
        targetType: 'article',
        metadata: { slug: 'my-article', title: 'My Article' },
      },
    });
  });

  it('accepts null actorId for background / system events', async () => {
    prismaMock.auditLog.create.mockResolvedValueOnce({} as never);

    await logEvent({
      eventType: AuditEventType.MCP_IMPORT_SUCCESS,
      actorId: null,
      targetId: 'article-1',
      targetType: 'article',
      metadata: { fileName: 'doc.md' },
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ actorId: null }) }),
    );
  });

  it('accepts null targetId', async () => {
    prismaMock.auditLog.create.mockResolvedValueOnce({} as never);

    await logEvent({
      eventType: AuditEventType.ARTICLE_CREATED,
      actorId: 'user-1',
      targetId: null,
      targetType: null,
      metadata: null,
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ targetId: null }) }),
    );
  });

  it('accepts null metadata and omits the metadata field from the db write', async () => {
    prismaMock.auditLog.create.mockResolvedValueOnce({} as never);

    await logEvent({
      eventType: AuditEventType.ARTICLE_DELETED,
      actorId: 'user-1',
      targetId: 'article-1',
      targetType: 'article',
      metadata: null,
    });

    // When metadata is null the field is omitted; Prisma stores the column's DB NULL default.
    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    const [[arg]] = (prismaMock.auditLog.create as jest.Mock).mock.calls as Array<
      [{ data: Record<string, unknown> }]
    >;
    expect(arg?.data).not.toHaveProperty('metadata');
  });

  it('does not throw when the database write fails', async () => {
    prismaMock.auditLog.create.mockRejectedValueOnce(new Error('DB unavailable'));

    await expect(
      logEvent({
        eventType: AuditEventType.ARTICLE_CREATED,
        actorId: 'user-1',
        targetId: 'article-1',
        targetType: 'article',
        metadata: null,
      }),
    ).resolves.toBeUndefined();
  });

  it('logs the error via logger when the database write fails', async () => {
    const dbError = new Error('DB unavailable');
    prismaMock.auditLog.create.mockRejectedValueOnce(dbError);

    await logEvent({
      eventType: AuditEventType.ARTICLE_CREATED,
      actorId: 'user-1',
      targetId: 'article-1',
      targetType: 'article',
      metadata: null,
    });

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({ err: dbError }),
      expect.stringContaining('Audit log'),
    );
  });
});
