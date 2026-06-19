import { ArticleStatus, AuditEventType, Role } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { canEditArticle, requirePermission } from '@/lib/auth/permissions';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import { slugify, slugifyWithSuffix } from '@/lib/utils/slugify';
import { createSnapshot } from '@/lib/services/revisions';
import { logEvent } from '@/lib/services/audit';
import type { AppSession, ArticleSummary, ArticleWithDetails, PaginatedResult } from '@/types';
import type { CreateArticleInput, UpdateArticleInput, ArticleListQuery } from '@/lib/validations/article';

// ─── Select objects ───────────────────────────────────────────────────────────

const ARTICLE_SUMMARY_SELECT = {
  id: true,
  slug: true,
  title: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  authorId: true,
  author: { select: { id: true, name: true } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
} as const;

const ARTICLE_DETAIL_SELECT = {
  id: true,
  slug: true,
  title: true,
  content: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  authorId: true,
  author: { select: { id: true, name: true } },
  tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
  _count: { select: { revisions: true } },
} as const;

// ─── Transformers ─────────────────────────────────────────────────────────────

type SummaryRaw = {
  id: string;
  slug: string;
  title: string;
  status: ArticleStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string };
  tags: { tag: { id: string; name: string; slug: string } }[];
};

type DetailRaw = SummaryRaw & {
  content: string;
  _count: { revisions: number };
};

function toArticleSummary(raw: SummaryRaw): ArticleSummary {
  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    status: raw.status,
    publishedAt: raw.publishedAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    author: raw.author,
    tags: raw.tags.map((at) => at.tag),
  };
}

function toArticleWithDetails(raw: DetailRaw): ArticleWithDetails {
  return {
    ...toArticleSummary(raw),
    content: raw.content,
    revisionCount: raw._count.revisions,
  };
}

// ─── Slug generation ──────────────────────────────────────────────────────────

async function generateUniqueSlug(baseSlug: string): Promise<string> {
  const existing = await db.article.findUnique({
    where: { slug: baseSlug },
    select: { id: true },
  });
  if (!existing) return baseSlug;

  let counter = 2;
  for (;;) {
    const candidate = slugifyWithSuffix(baseSlug, counter);
    const taken = await db.article.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
    counter++;
  }
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function listArticles(
  query: ArticleListQuery,
  session: AppSession,
): Promise<PaginatedResult<ArticleSummary>> {
  requirePermission(session, 'article:read');

  let where: Prisma.ArticleWhereInput = { deletedAt: null };

  if (session.user.role === Role.VIEWER) {
    where = { ...where, status: ArticleStatus.PUBLISHED };
  } else if (session.user.role === Role.EDITOR) {
    where = {
      ...where,
      OR: [
        { status: { not: ArticleStatus.DRAFT } },
        { status: ArticleStatus.DRAFT, authorId: session.user.id },
      ],
    };
  }

  if (query.status !== undefined) {
    where = { ...where, status: query.status };
  }

  if (query.authorId !== undefined) {
    where = { ...where, authorId: query.authorId };
  }

  const skip = (query.page - 1) * query.limit;

  const [total, articles] = await db.$transaction([
    db.article.count({ where }),
    db.article.findMany({
      where,
      select: ARTICLE_SUMMARY_SELECT,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    data: (articles as SummaryRaw[]).map(toArticleSummary),
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getArticleBySlug(
  slug: string,
  session: AppSession,
): Promise<ArticleWithDetails> {
  const article = await db.article.findUnique({
    where: { slug, deletedAt: null },
    select: ARTICLE_DETAIL_SELECT,
  });

  if (!article) throw new NotFoundError('Article not found');

  if (article.status === ArticleStatus.DRAFT) {
    const canSee =
      article.authorId === session.user.id || session.user.role === Role.ADMIN;
    if (!canSee) throw new ForbiddenError('You do not have access to this draft');
  }

  return toArticleWithDetails(article as unknown as DetailRaw);
}

export async function createArticle(
  data: CreateArticleInput,
  session: AppSession,
): Promise<ArticleWithDetails> {
  requirePermission(session, 'article:create');

  const baseSlug = slugify(data.title);
  const slug = await generateUniqueSlug(baseSlug);

  const article = await db.$transaction(async (tx) => {
    const created = await tx.article.create({
      data: {
        slug,
        title: data.title,
        content: data.content,
        status: data.status ?? ArticleStatus.DRAFT,
        authorId: session.user.id,
        publishedAt: data.status === ArticleStatus.PUBLISHED ? new Date() : null,
        ...(data.tagIds.length > 0
          ? { tags: { create: data.tagIds.map((tagId) => ({ tagId })) } }
          : {}),
      },
      select: ARTICLE_DETAIL_SELECT,
    });

    await createSnapshot(
      created.id,
      {
        title: created.title,
        content: created.content,
        ...(data.changeSummary !== undefined ? { changeSummary: data.changeSummary } : {}),
      },
      session,
      tx,
    );

    return created;
  });

  const result = toArticleWithDetails(article as unknown as DetailRaw);

  await logEvent({
    eventType: AuditEventType.ARTICLE_CREATED,
    actorId: session.user.id,
    targetId: result.id,
    targetType: 'article',
    metadata: { slug: result.slug, title: result.title },
  });

  return result;
}

export async function updateArticle(
  slug: string,
  data: UpdateArticleInput,
  session: AppSession,
): Promise<ArticleWithDetails> {
  const existing = await db.article.findUnique({
    where: { slug, deletedAt: null },
    select: { id: true, authorId: true, title: true, content: true },
  });

  if (!existing) throw new NotFoundError('Article not found');
  if (!canEditArticle(session, existing)) {
    throw new ForbiddenError('You cannot edit this article');
  }

  const article = await db.$transaction(async (tx) => {
    const updateData: Prisma.ArticleUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === ArticleStatus.PUBLISHED) {
        updateData.publishedAt = new Date();
      }
    }
    if (data.tagIds !== undefined) {
      updateData.tags = {
        deleteMany: {},
        create: data.tagIds.map((tagId) => ({ tagId })),
      };
    }

    const updated = await tx.article.update({
      where: { id: existing.id },
      data: updateData,
      select: ARTICLE_DETAIL_SELECT,
    });

    await createSnapshot(
      existing.id,
      {
        title: updated.title,
        content: updated.content,
        ...(data.changeSummary !== undefined ? { changeSummary: data.changeSummary } : {}),
      },
      session,
      tx,
    );

    return updated;
  });

  const result = toArticleWithDetails(article as unknown as DetailRaw);

  await logEvent({
    eventType: AuditEventType.ARTICLE_UPDATED,
    actorId: session.user.id,
    targetId: result.id,
    targetType: 'article',
    metadata: { slug: result.slug },
  });

  return result;
}

export async function deleteArticle(slug: string, session: AppSession): Promise<void> {
  requirePermission(session, 'article:delete');

  const article = await db.article.findUnique({
    where: { slug, deletedAt: null },
    select: { id: true },
  });

  if (!article) throw new NotFoundError('Article not found');

  await db.article.update({
    where: { id: article.id },
    data: { deletedAt: new Date() },
  });

  await logEvent({
    eventType: AuditEventType.ARTICLE_DELETED,
    actorId: session.user.id,
    targetId: article.id,
    targetType: 'article',
    metadata: { slug },
  });
}

export async function createFromImport(
  data: { title: string; content: string },
  session: AppSession,
): Promise<ArticleWithDetails> {
  requirePermission(session, 'article:create');

  const baseSlug = slugify(data.title);
  const slug = await generateUniqueSlug(baseSlug);

  const article = await db.$transaction(async (tx) => {
    const created = await tx.article.create({
      data: {
        slug,
        title: data.title,
        content: data.content,
        status: ArticleStatus.DRAFT,
        authorId: session.user.id,
        publishedAt: null,
      },
      select: ARTICLE_DETAIL_SELECT,
    });

    await createSnapshot(
      created.id,
      { title: created.title, content: created.content, changeSummary: 'Imported via MCP' },
      session,
      tx,
    );

    return created;
  });

  return toArticleWithDetails(article as unknown as DetailRaw);
}
