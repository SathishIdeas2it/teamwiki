import { ArticleStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { requirePermission } from '@/lib/auth/permissions';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { slugify } from '@/lib/utils/slugify';
import type { AppSession, TagWithCategory, ArticleSummary, PaginatedResult } from '@/types';
import type { CreateTagInput, UpdateTagInput } from '@/lib/validations/tag';

const TAG_SELECT = {
  id: true,
  name: true,
  slug: true,
  category: { select: { id: true, name: true, slug: true } },
  _count: { select: { articles: true } },
} as const;

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

function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
  );
}

type TagRaw = {
  id: string;
  name: string;
  slug: string;
  category: { id: string; name: string; slug: string } | null;
  _count: { articles: number };
};

type ArticleSummaryRaw = {
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

function toTagWithCategory(raw: TagRaw): TagWithCategory {
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    category: raw.category,
    articleCount: raw._count.articles,
  };
}

function toArticleSummary(raw: ArticleSummaryRaw): ArticleSummary {
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

export async function listTags(session: AppSession): Promise<TagWithCategory[]> {
  void session;

  const tags = await db.tag.findMany({
    select: TAG_SELECT,
    orderBy: { name: 'asc' },
  });

  return (tags as TagRaw[]).map(toTagWithCategory);
}

export async function createTag(
  data: CreateTagInput,
  session: AppSession,
): Promise<TagWithCategory> {
  requirePermission(session, 'admin:access');

  const slug = slugify(data.name);

  try {
    const tag = await db.tag.create({
      data: {
        name: data.name,
        slug,
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      },
      select: TAG_SELECT,
    });
    return toTagWithCategory(tag as TagRaw);
  } catch (err) {
    if (isPrismaUniqueConstraintError(err)) {
      throw new ConflictError(`A tag with the name "${data.name}" already exists`);
    }
    throw err;
  }
}

export async function updateTag(
  slug: string,
  data: UpdateTagInput,
  session: AppSession,
): Promise<TagWithCategory> {
  requirePermission(session, 'admin:access');

  const existing = await db.tag.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError('Tag not found');

  const updateData: Prisma.TagUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if ('categoryId' in data) {
    updateData.category = data.categoryId
      ? { connect: { id: data.categoryId } }
      : { disconnect: true };
  }

  const tag = await db.tag.update({
    where: { id: existing.id },
    data: updateData,
    select: TAG_SELECT,
  });

  return toTagWithCategory(tag as TagRaw);
}

export async function deleteTag(slug: string, session: AppSession): Promise<void> {
  requirePermission(session, 'admin:access');

  const existing = await db.tag.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError('Tag not found');

  await db.tag.delete({ where: { id: existing.id } });
}

export async function listArticlesByTag(
  slug: string,
  page: number,
  limit: number,
  session: AppSession,
): Promise<PaginatedResult<ArticleSummary>> {
  void session;

  const tag = await db.tag.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!tag) throw new NotFoundError('Tag not found');

  const where: Prisma.ArticleWhereInput = {
    deletedAt: null,
    status: ArticleStatus.PUBLISHED,
    tags: { some: { tagId: tag.id } },
  };

  const skip = (page - 1) * limit;

  const [total, articles] = await db.$transaction([
    db.article.count({ where }),
    db.article.findMany({
      where,
      select: ARTICLE_SUMMARY_SELECT,
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    data: (articles as ArticleSummaryRaw[]).map(toArticleSummary),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
