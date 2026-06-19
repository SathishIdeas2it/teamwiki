import type { AuditEventType, Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { logger } from '@/lib/logger';

export type LogEventParams = {
  eventType: AuditEventType;
  actorId: string | null;
  targetId: string | null;
  targetType: string | null;
  metadata: Record<string, unknown> | null;
};

export async function logEvent(params: LogEventParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        eventType: params.eventType,
        actorId: params.actorId,
        targetId: params.targetId,
        targetType: params.targetType,
        // Prisma v5 nullable JSON: omit the field entirely when null so the column
        // defaults to DB NULL, avoiding the NullableJsonNullValueInput sentinel.
        ...(params.metadata !== null
          ? { metadata: params.metadata as Prisma.InputJsonValue }
          : {}),
      },
    });
  } catch (err) {
    // Audit failures must never break the main operation — swallow and log only.
    logger.error({ err }, 'Audit log write failed — event was not persisted');
  }
}
