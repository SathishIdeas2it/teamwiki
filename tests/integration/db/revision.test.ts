import { Role } from '@prisma/client';
import { prisma, createTestUser } from '../helpers/db';

describe('ArticleRevision model', () => {
  let authorId: string;
  let articleId: string;

  beforeEach(async () => {
    const author = await createTestUser({ email: 'revisor@example.com', role: Role.EDITOR });
    authorId = author.id;

    const article = await prisma.article.create({
      data: {
        slug: `revisable-${Date.now()}`,
        title: 'Revisable Article',
        content: 'Initial content',
        authorId,
      },
      select: { id: true },
    });
    articleId = article.id;
  });

  describe('create', () => {
    it('generates a UUID primary key', async () => {
      const revision = await prisma.articleRevision.create({
        data: { articleId, revisionNumber: 1, title: 'T', content: 'c', authorId },
        select: { id: true },
      });
      expect(revision.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('populates createdAt on creation', async () => {
      const revision = await prisma.articleRevision.create({
        data: { articleId, revisionNumber: 1, title: 'T', content: 'c', authorId },
        select: { createdAt: true },
      });
      expect(revision.createdAt).toBeInstanceOf(Date);
    });

    it('stores a snapshot of the title and content independently from the article', async () => {
      await prisma.articleRevision.create({
        data: { articleId, revisionNumber: 1, title: 'Original Title', content: 'Original content', authorId },
      });

      await prisma.article.update({
        where: { id: articleId },
        data: { title: 'Updated Title', content: 'Updated content' },
      });

      const revision = await prisma.articleRevision.findFirst({
        where: { articleId, revisionNumber: 1 },
        select: { title: true, content: true },
      });
      expect(revision?.title).toBe('Original Title');
      expect(revision?.content).toBe('Original content');
    });

    it('stores optional changeSummary', async () => {
      const revision = await prisma.articleRevision.create({
        data: {
          articleId,
          revisionNumber: 1,
          title: 'T',
          content: 'c',
          authorId,
          changeSummary: 'Fixed typo in introduction',
        },
        select: { changeSummary: true },
      });
      expect(revision.changeSummary).toBe('Fixed typo in introduction');
    });

    it('allows null changeSummary', async () => {
      const revision = await prisma.articleRevision.create({
        data: { articleId, revisionNumber: 1, title: 'T', content: 'c', authorId },
        select: { changeSummary: true },
      });
      expect(revision.changeSummary).toBeNull();
    });

    it('enforces unique constraint on (articleId, revisionNumber)', async () => {
      await prisma.articleRevision.create({
        data: { articleId, revisionNumber: 1, title: 'T', content: 'c', authorId },
      });
      await expect(
        prisma.articleRevision.create({
          data: { articleId, revisionNumber: 1, title: 'T2', content: 'c2', authorId },
        }),
      ).rejects.toThrow();
    });

    it('allows same revisionNumber for different articles', async () => {
      const article2 = await prisma.article.create({
        data: { slug: `other-article-${Date.now()}`, title: 'Other', content: 'content', authorId },
        select: { id: true },
      });

      await prisma.articleRevision.create({
        data: { articleId, revisionNumber: 1, title: 'T', content: 'c', authorId },
      });
      await expect(
        prisma.articleRevision.create({
          data: { articleId: article2.id, revisionNumber: 1, title: 'T', content: 'c', authorId },
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('ordering', () => {
    it('returns revisions in descending revisionNumber order', async () => {
      for (let i = 1; i <= 4; i++) {
        await prisma.articleRevision.create({
          data: { articleId, revisionNumber: i, title: `V${i}`, content: `content v${i}`, authorId },
        });
      }

      const revisions = await prisma.articleRevision.findMany({
        where: { articleId },
        orderBy: { revisionNumber: 'desc' },
        select: { revisionNumber: true },
      });

      expect(revisions.map((r) => r.revisionNumber)).toEqual([4, 3, 2, 1]);
    });

    it('retrieves the latest revision via findFirst with descending order', async () => {
      for (let i = 1; i <= 5; i++) {
        await prisma.articleRevision.create({
          data: { articleId, revisionNumber: i, title: `V${i}`, content: `v${i}`, authorId },
        });
      }

      const latest = await prisma.articleRevision.findFirst({
        where: { articleId },
        orderBy: { revisionNumber: 'desc' },
        select: { revisionNumber: true },
      });

      expect(latest?.revisionNumber).toBe(5);
    });

    it('computes next revisionNumber from max of existing revisions', async () => {
      for (let i = 1; i <= 3; i++) {
        await prisma.articleRevision.create({
          data: { articleId, revisionNumber: i, title: `V${i}`, content: `v${i}`, authorId },
        });
      }

      const latest = await prisma.articleRevision.findFirst({
        where: { articleId },
        orderBy: { revisionNumber: 'desc' },
        select: { revisionNumber: true },
      });
      const nextRevisionNumber = (latest?.revisionNumber ?? 0) + 1;

      await expect(
        prisma.articleRevision.create({
          data: { articleId, revisionNumber: nextRevisionNumber, title: 'V4', content: 'v4', authorId },
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('cascade behaviour', () => {
    it('hard-deletes all revisions when the parent article is hard-deleted', async () => {
      for (let i = 1; i <= 3; i++) {
        await prisma.articleRevision.create({
          data: { articleId, revisionNumber: i, title: `V${i}`, content: `v${i}`, authorId },
        });
      }

      await prisma.article.delete({ where: { id: articleId } });

      const count = await prisma.articleRevision.count({ where: { articleId } });
      expect(count).toBe(0);
    });

    it('keeps revisions when article is soft-deleted', async () => {
      await prisma.articleRevision.create({
        data: { articleId, revisionNumber: 1, title: 'T', content: 'c', authorId },
      });

      await prisma.article.update({ where: { id: articleId }, data: { deletedAt: new Date() } });

      const count = await prisma.articleRevision.count({ where: { articleId } });
      expect(count).toBe(1);
    });
  });
});
