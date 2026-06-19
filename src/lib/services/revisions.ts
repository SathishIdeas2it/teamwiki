import type { PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { NotFoundError } from '@/lib/errors';
import type { AppSession, RevisionSummary, RevisionDetail } from '@/types';

export type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export async function createSnapshot(
  articleId: string,
  data: { title: string; content: string; changeSummary?: string },
  session: AppSession,
  tx: PrismaTransaction,
): Promise<void> {
  const { _max } = await tx.articleRevision.aggregate({
    _max: { revisionNumber: true },
    where: { articleId },
  });

  const revisionNumber = (_max.revisionNumber ?? 0) + 1;

  await tx.articleRevision.create({
    data: {
      articleId,
      revisionNumber,
      title: data.title,
      content: data.content,
      authorId: session.user.id,
      changeSummary: data.changeSummary ?? null,
    },
  });
}

export async function listByArticle(
  articleId: string,
  session: AppSession,
): Promise<RevisionSummary[]> {
  void session;

  const article = await db.article.findUnique({
    where: { id: articleId, deletedAt: null },
    select: { id: true },
  });
  if (!article) throw new NotFoundError('Article not found');

  const revisions = await db.articleRevision.findMany({
    where: { articleId },
    orderBy: { revisionNumber: 'desc' },
    select: {
      id: true,
      revisionNumber: true,
      changeSummary: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
    },
  });

  return revisions.map((r) => ({
    id: r.id,
    revisionNumber: r.revisionNumber,
    authorName: r.author.name,
    changeSummary: r.changeSummary,
    createdAt: r.createdAt,
  }));
}

export async function findById(
  revisionId: string,
  session: AppSession,
): Promise<RevisionDetail> {
  void session;

  const revision = await db.articleRevision.findUnique({
    where: { id: revisionId },
    select: {
      id: true,
      revisionNumber: true,
      title: true,
      content: true,
      changeSummary: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
    },
  });

  if (!revision) throw new NotFoundError('Revision not found');

  return {
    id: revision.id,
    revisionNumber: revision.revisionNumber,
    title: revision.title,
    content: revision.content,
    authorName: revision.author.name,
    changeSummary: revision.changeSummary,
    createdAt: revision.createdAt,
  };
}
