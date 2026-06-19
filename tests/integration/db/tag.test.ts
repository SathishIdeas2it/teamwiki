import { prisma, createTestUser } from '../helpers/db';

describe('Tag and Category models', () => {
  describe('Category', () => {
    it('generates a UUID primary key', async () => {
      const category = await prisma.category.create({
        data: { name: 'Engineering', slug: 'engineering' },
        select: { id: true },
      });
      expect(category.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('populates createdAt and updatedAt on creation', async () => {
      const category = await prisma.category.create({
        data: { name: 'Process', slug: 'process' },
        select: { createdAt: true, updatedAt: true },
      });
      expect(category.createdAt).toBeInstanceOf(Date);
      expect(category.updatedAt).toBeInstanceOf(Date);
    });

    it('advances updatedAt when name is modified', async () => {
      const category = await prisma.category.create({
        data: { name: 'Old Name', slug: 'old-name' },
        select: { id: true, updatedAt: true },
      });
      const original = category.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 50));

      const updated = await prisma.category.update({
        where: { id: category.id },
        data: { description: 'Updated description' },
        select: { updatedAt: true },
      });

      expect(updated.updatedAt.getTime()).toBeGreaterThan(original.getTime());
    });

    it('enforces unique category name', async () => {
      await prisma.category.create({ data: { name: 'Unique Category', slug: 'unique-category' } });
      await expect(
        prisma.category.create({ data: { name: 'Unique Category', slug: 'unique-category-2' } }),
      ).rejects.toThrow();
    });

    it('enforces unique category slug', async () => {
      await prisma.category.create({ data: { name: 'Category One', slug: 'cat-slug-dup' } });
      await expect(
        prisma.category.create({ data: { name: 'Category Two', slug: 'cat-slug-dup' } }),
      ).rejects.toThrow();
    });

    it('allows optional description', async () => {
      const category = await prisma.category.create({
        data: { name: 'No Description', slug: 'no-description' },
        select: { description: true },
      });
      expect(category.description).toBeNull();
    });
  });

  describe('Tag', () => {
    it('generates a UUID primary key', async () => {
      const tag = await prisma.tag.create({
        data: { name: 'Backend', slug: 'backend' },
        select: { id: true },
      });
      expect(tag.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('populates createdAt and updatedAt on creation', async () => {
      const tag = await prisma.tag.create({
        data: { name: 'Frontend', slug: 'frontend' },
        select: { createdAt: true, updatedAt: true },
      });
      expect(tag.createdAt).toBeInstanceOf(Date);
      expect(tag.updatedAt).toBeInstanceOf(Date);
    });

    it('advances updatedAt when name is modified', async () => {
      const tag = await prisma.tag.create({
        data: { name: 'DevOps', slug: 'devops' },
        select: { id: true, updatedAt: true },
      });
      const original = tag.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 50));

      const updated = await prisma.tag.update({
        where: { id: tag.id },
        data: { name: 'DevOps Updated' },
        select: { updatedAt: true },
      });

      expect(updated.updatedAt.getTime()).toBeGreaterThan(original.getTime());
    });

    it('enforces unique tag name', async () => {
      await prisma.tag.create({ data: { name: 'Unique Tag', slug: 'unique-tag' } });
      await expect(
        prisma.tag.create({ data: { name: 'Unique Tag', slug: 'unique-tag-2' } }),
      ).rejects.toThrow();
    });

    it('enforces unique tag slug', async () => {
      await prisma.tag.create({ data: { name: 'Tag One', slug: 'tag-slug-dup' } });
      await expect(
        prisma.tag.create({ data: { name: 'Tag Two', slug: 'tag-slug-dup' } }),
      ).rejects.toThrow();
    });

    it('accepts a nullable categoryId', async () => {
      const tag = await prisma.tag.create({
        data: { name: 'Uncategorized Tag', slug: 'uncategorized-tag' },
        select: { categoryId: true },
      });
      expect(tag.categoryId).toBeNull();
    });

    it('links to a parent category', async () => {
      const category = await prisma.category.create({
        data: { name: 'Parent Category', slug: 'parent-category' },
        select: { id: true },
      });
      const tag = await prisma.tag.create({
        data: { name: 'Child Tag', slug: 'child-tag', categoryId: category.id },
        select: { categoryId: true },
      });
      expect(tag.categoryId).toBe(category.id);
    });

    it('sets categoryId to null (SET NULL) when parent category is deleted', async () => {
      const category = await prisma.category.create({
        data: { name: 'Doomed Category', slug: 'doomed-category' },
        select: { id: true },
      });
      const tag = await prisma.tag.create({
        data: { name: 'Orphaned Tag', slug: 'orphaned-tag', categoryId: category.id },
        select: { id: true },
      });

      await prisma.category.delete({ where: { id: category.id } });

      const found = await prisma.tag.findUnique({
        where: { id: tag.id },
        select: { categoryId: true },
      });
      expect(found?.categoryId).toBeNull();
    });
  });

  describe('ArticleTag join table', () => {
    let authorId: string;
    let articleId: string;
    let tagId: string;

    beforeEach(async () => {
      const author = await createTestUser({ email: 'tagger@example.com' });
      authorId = author.id;

      const article = await prisma.article.create({
        data: { slug: `tag-article-${Date.now()}`, title: 'Tag Test', content: 'content', authorId },
        select: { id: true },
      });
      articleId = article.id;

      const tag = await prisma.tag.create({
        data: { name: `Test Tag ${Date.now()}`, slug: `test-tag-${Date.now()}` },
        select: { id: true },
      });
      tagId = tag.id;
    });

    it('creates an article-tag association', async () => {
      await prisma.articleTag.create({ data: { articleId, tagId } });

      const count = await prisma.articleTag.count({ where: { articleId, tagId } });
      expect(count).toBe(1);
    });

    it('rejects duplicate article-tag pairs (composite PK)', async () => {
      await prisma.articleTag.create({ data: { articleId, tagId } });
      await expect(
        prisma.articleTag.create({ data: { articleId, tagId } }),
      ).rejects.toThrow();
    });

    it('cascades delete when the article is deleted', async () => {
      await prisma.articleTag.create({ data: { articleId, tagId } });
      await prisma.article.delete({ where: { id: articleId } });

      const count = await prisma.articleTag.count({ where: { articleId } });
      expect(count).toBe(0);
    });

    it('cascades delete when the tag is deleted', async () => {
      await prisma.articleTag.create({ data: { articleId, tagId } });
      await prisma.tag.delete({ where: { id: tagId } });

      const count = await prisma.articleTag.count({ where: { tagId } });
      expect(count).toBe(0);
    });

    it('allows an article to have multiple tags', async () => {
      const tag2 = await prisma.tag.create({
        data: { name: `Tag B ${Date.now()}`, slug: `tag-b-${Date.now()}` },
        select: { id: true },
      });

      await prisma.articleTag.createMany({
        data: [{ articleId, tagId }, { articleId, tagId: tag2.id }],
      });

      const count = await prisma.articleTag.count({ where: { articleId } });
      expect(count).toBe(2);
    });

    it('allows the same tag to be on multiple articles', async () => {
      const article2 = await prisma.article.create({
        data: { slug: `second-article-${Date.now()}`, title: 'Second', content: 'content', authorId },
        select: { id: true },
      });

      await prisma.articleTag.createMany({
        data: [{ articleId, tagId }, { articleId: article2.id, tagId }],
      });

      const count = await prisma.articleTag.count({ where: { tagId } });
      expect(count).toBe(2);
    });
  });
});
