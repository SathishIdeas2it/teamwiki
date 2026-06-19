import type { AppSession, RevisionSummary, RevisionDetail } from '@/types';
import type { PrismaClient } from '@prisma/client';

type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export async function createSnapshot(
  articleId: string,
  data: { title: string; content: string; changeSummary?: string },
  session: AppSession,
  tx: PrismaTransaction,
): Promise<void> {
  throw new Error('Not implemented');
}

export async function listByArticle(
  articleId: string,
  session: AppSession,
): Promise<RevisionSummary[]> {
  throw new Error('Not implemented');
}

export async function findById(
  revisionId: string,
  session: AppSession,
): Promise<RevisionDetail> {
  throw new Error('Not implemented');
}
