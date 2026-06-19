import { ArticleStatus, Role } from '@prisma/client';
import { prisma, createTestUser } from '../helpers/db';

describe('Article model', () => {
  let authorId: string;

  beforeEach(async () => {
    const author = await createTestUser({ email: 'author@example.com', role: Role.EDITOR });
    authorId = author.id;
  });

  describe('create', () => {
    it('generates a UUID primary key', async () => {
      const article = await prisma.article.create({
        data: { slug: 'uuid-article', title: 'UUID Article', content: 'content', authorId },
        select: { id: true },
      });
      expect(article.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('defaults status to DRAFT', async () => {
      const article = await prisma.article.create({
        data: { slug: 'draft-default', title: 'Draft Default', content: 'content', authorId },
        select: { status: true },
      });
      expect(article.status).toBe(ArticleStatus.DRAFT);
    });

    it('populates createdAt and updatedAt on creation', async () => {
      const article = await prisma.article.create({
        data: { slug: 'ts-article', title: 'TS Article', content: 'content', authorId },
        select: { createdAt: true, updatedAt: true },
      });
      expect(article.createdAt).toBeInstanceOf(Date);
      expect(article.updatedAt).toBeInstanceOf(Date);
    });

    it('defaults deletedAt to null', async () => {
      const article = await prisma.article.create({
        data: { slug: 'no-delete', title: 'No Delete', content: 'content', authorId },
        select: { deletedAt: true },
      });
      expect(article.deletedAt).toBeNull();
    });

    it('enforces unique slug', async () => {
      await prisma.article.create({
        data: { slug: 'dup-slug', title: 'First', content: 'content', authorId },
      });
      await expect(
        prisma.article.create({
          data: { slug: 'dup-slug', title: 'Second', content: 'content', authorId },
        }),
      ).rejects.toThrow();
    });

    it('stores publishedAt when provided', async () => {
      const publishedAt = new Date('2024-06-01T10:00:00Z');
      const article = await prisma.article.create({
        data: {
          slug: 'published',
          title: 'Published',
          content: 'content',
          status: ArticleStatus.PUBLISHED,
          authorId,
          publishedAt,
        },
        select: { publishedAt: true },
      });
      expect(article.publishedAt?.toISOString()).toBe(publishedAt.toISOString());
    });

    it('allows null publishedAt (draft state)', async () => {
      const article = await prisma.article.create({
        data: { slug: 'no-publish-date', title: 'No Publish Date', content: 'content', authorId },
        select: { publishedAt: true },
      });
      expect(article.publishedAt).toBeNull();
    });
  });

  describe('soft delete', () => {
    it('sets deletedAt when soft-deleting an article', async () => {
      const article = await prisma.article.create({
        data: { slug: 'soft-del-article', title: 'Soft Delete', content: 'content', authorId },
        select: { id: true },
      });

      await prisma.article.update({ where: { id: article.id }, data: { deletedAt: new Date() } });

      const found = await prisma.article.findUnique({
        where: { id: article.id },
        select: { deletedAt: true },
      });
      expect(found?.deletedAt).toBeInstanceOf(Date);
    });

    it('soft-deleted article remains in the database', async () => {
      const article = await prisma.article.create({
        data: { slug: 'ghost-article', title: 'Ghost', content: 'content', authorId },
        select: { id: true },
      });
      await prisma.article.update({ where: { id: article.id }, data: { deletedAt: new Date() } });

      const count = await prisma.article.count({ where: { id: article.id } });
      expect(count).toBe(1);
    });

    it('active filter (deletedAt: null) excludes soft-deleted articles', async () => {
      const article = await prisma.article.create({
        data: { slug: 'excluded-article', title: 'Excluded', content: 'content', authorId },
        select: { id: true },
      });
      await prisma.article.update({ where: { id: article.id }, data: { deletedAt: new Date() } });

      const count = await prisma.article.count({ where: { id: article.id, deletedAt: null } });
      expect(count).toBe(0);
    });

    it('revisions survive article soft-delete (no cascade on deletedAt)', async () => {
      const article = await prisma.article.create({
        data: {
          slug: 'revisions-survive',
          title: 'Revisions Survive',
          content: 'content',
          authorId,
          revisions: {
            create: { revisionNumber: 1, title: 'Revisions Survive', content: 'content', authorId },
          },
        },
        select: { id: true },
      });

      await prisma.article.update({ where: { id: article.id }, data: { deletedAt: new Date() } });

      const revCount = await prisma.articleRevision.count({ where: { articleId: article.id } });
      expect(revCount).toBe(1);
    });
  });

  describe('statuses', () => {
    it.each([ArticleStatus.DRAFT, ArticleStatus.PUBLISHED, ArticleStatus.ARCHIVED])(
      'stores status %s correctly',
      async (status) => {
        const article = await prisma.article.create({
          data: {
            slug: `status-${status.toLowerCase()}-${Date.now()}`,
            title: status,
            content: 'content',
            authorId,
            status,
          },
          select: { status: true },
        });
        expect(article.status).toBe(status);
      },
    );
  });

  describe('relationships', () => {
    it('resolves the author relation', async () => {
      const article = await prisma.article.create({
        data: { slug: 'with-author', title: 'With Author', content: 'content', authorId },
        include: { author: { select: { id: true } } },
      });
      expect(article.author.id).toBe(authorId);
    });

    it('rejects creation with a non-existent authorId', async () => {
      await expect(
        prisma.article.create({
          data: {
            slug: 'orphan-article',
            title: 'Orphan',
            content: 'content',
            authorId: '00000000-0000-0000-0000-000000000000',
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('updatedAt', () => {
    it('advances updatedAt when content is modified', async () => {
      const article = await prisma.article.create({
        data: { slug: 'update-ts', title: 'Original', content: 'original content', authorId },
        select: { id: true, updatedAt: true },
      });
      const originalUpdatedAt = article.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 50));

      const updated = await prisma.article.update({
        where: { id: article.id },
        data: { content: 'updated content' },
        select: { updatedAt: true },
      });

      expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});
