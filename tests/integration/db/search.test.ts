import { ArticleStatus, Role } from '@prisma/client';
import { prisma, createTestUser } from '../helpers/db';
import { fullTextSearch, countSearchResults } from '@/lib/db/search';

// These tests require the FTS trigger to be installed:
//   CREATE TRIGGER articles_search_vector_update
//   BEFORE INSERT OR UPDATE OF title, content ON articles
//   FOR EACH ROW EXECUTE FUNCTION articles_search_vector_update();

describe('Full-text search (FTS)', () => {
  let authorId: string;

  beforeEach(async () => {
    const author = await createTestUser({ email: 'fts-author@example.com', role: Role.EDITOR });
    authorId = author.id;
  });

  async function createPublishedArticle(opts: {
    slug: string;
    title: string;
    content: string;
  }): Promise<string> {
    const article = await prisma.article.create({
      data: {
        slug: opts.slug,
        title: opts.title,
        content: opts.content,
        status: ArticleStatus.PUBLISHED,
        authorId,
        publishedAt: new Date(),
      },
      select: { id: true },
    });
    return article.id;
  }

  describe('fullTextSearch', () => {
    it('finds an article by a keyword in its title', async () => {
      await createPublishedArticle({
        slug: 'typescript-guide',
        title: 'TypeScript Guide',
        content: 'An overview of TypeScript features.',
      });

      const results = await fullTextSearch('TypeScript', [], 10, 0);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.slug === 'typescript-guide')).toBe(true);
    });

    it('finds an article by a keyword in its content', async () => {
      await createPublishedArticle({
        slug: 'k8s-guide',
        title: 'Container Orchestration',
        content: 'Kubernetes enables declarative cluster management.',
      });

      const results = await fullTextSearch('kubernetes', [], 10, 0);

      expect(results.some((r) => r.slug === 'k8s-guide')).toBe(true);
    });

    it('returns empty array when no articles match', async () => {
      const results = await fullTextSearch('xyzzy_no_match_ever', [], 10, 0);
      expect(results).toHaveLength(0);
    });

    it('excludes DRAFT articles', async () => {
      const term = `draftterm${Date.now()}`;
      await prisma.article.create({
        data: {
          slug: `draft-${Date.now()}`,
          title: `Draft ${term}`,
          content: `${term} draft only`,
          status: ArticleStatus.DRAFT,
          authorId,
        },
      });

      const results = await fullTextSearch(term, [], 10, 0);
      expect(results).toHaveLength(0);
    });

    it('excludes ARCHIVED articles', async () => {
      const term = `archivedterm${Date.now()}`;
      await prisma.article.create({
        data: {
          slug: `archived-${Date.now()}`,
          title: `Archived ${term}`,
          content: `${term} archived only`,
          status: ArticleStatus.ARCHIVED,
          authorId,
        },
      });

      const results = await fullTextSearch(term, [], 10, 0);
      expect(results).toHaveLength(0);
    });

    it('excludes soft-deleted articles', async () => {
      const term = `deletedterm${Date.now()}`;
      const id = await createPublishedArticle({
        slug: `soft-del-${Date.now()}`,
        title: `Deleted Article ${term}`,
        content: `${term} content`,
      });
      await prisma.article.update({ where: { id }, data: { deletedAt: new Date() } });

      const results = await fullTextSearch(term, [], 10, 0);
      expect(results).toHaveLength(0);
    });

    it('ranks title-weight (A) higher than content-weight (B)', async () => {
      const term = `rankterm${Date.now()}`;
      await createPublishedArticle({
        slug: `title-weight-${Date.now()}`,
        title: `${term} in title`,
        content: 'General content without the keyword.',
      });
      await createPublishedArticle({
        slug: `content-weight-${Date.now()}`,
        title: 'General Title',
        content: `${term} mentioned deep in the content here.`,
      });

      const results = await fullTextSearch(term, [], 10, 0);

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results[0]?.title).toContain(`${term} in title`);
    });

    it('respects limit and returns at most limit rows', async () => {
      const term = `limitterm${Date.now()}`;
      for (let i = 1; i <= 5; i++) {
        await createPublishedArticle({
          slug: `limit-art-${i}-${Date.now()}`,
          title: `Limit Article ${i}`,
          content: `${term} content`,
        });
      }

      const results = await fullTextSearch(term, [], 3, 0);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('respects offset for pagination', async () => {
      const term = `offsetterm${Date.now()}`;
      for (let i = 1; i <= 4; i++) {
        await createPublishedArticle({
          slug: `offset-art-${i}-${Date.now()}`,
          title: `Offset Article ${i}`,
          content: `${term} content`,
        });
      }

      const page1 = await fullTextSearch(term, [], 2, 0);
      const page2 = await fullTextSearch(term, [], 2, 2);

      expect(page1).toHaveLength(2);
      expect(page2.length).toBeGreaterThan(0);
      const page1Ids = new Set(page1.map((r) => r.id));
      expect(page2.every((r) => !page1Ids.has(r.id))).toBe(true);
    });

    it('filters by tag slug when provided', async () => {
      const term = `tagterm${Date.now()}`;
      const tag = await prisma.tag.create({
        data: { name: `Filter Tag ${Date.now()}`, slug: `filter-tag-${Date.now()}` },
        select: { id: true, slug: true },
      });

      const taggedId = await createPublishedArticle({
        slug: `tagged-${Date.now()}`,
        title: `Tagged ${term}`,
        content: `${term} tagged article`,
      });
      await prisma.articleTag.create({ data: { articleId: taggedId, tagId: tag.id } });

      await createPublishedArticle({
        slug: `untagged-${Date.now()}`,
        title: `Untagged ${term}`,
        content: `${term} untagged article`,
      });

      const results = await fullTextSearch(term, [tag.slug], 10, 0);

      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe(taggedId);
    });

    it('returns results for all matching articles when tag list is empty', async () => {
      const term = `notagterm${Date.now()}`;
      await createPublishedArticle({ slug: `notag1-${Date.now()}`, title: `No Tag 1 ${term}`, content: `${term}` });
      await createPublishedArticle({ slug: `notag2-${Date.now()}`, title: `No Tag 2 ${term}`, content: `${term}` });

      const results = await fullTextSearch(term, [], 10, 0);
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('returns excerpt containing mark tags around matched term', async () => {
      const term = `excerptterm${Date.now()}`;
      await createPublishedArticle({
        slug: `excerpt-${Date.now()}`,
        title: 'Excerpt Test',
        content: `This article has the ${term} keyword inside.`,
      });

      const results = await fullTextSearch(term, [], 10, 0);

      expect(results[0]?.excerpt).toContain('<mark>');
      expect(results[0]?.excerpt).toContain('</mark>');
    });

    it('maps all expected fields on each result', async () => {
      const term = `fieldsterm${Date.now()}`;
      await createPublishedArticle({
        slug: `fields-${Date.now()}`,
        title: 'Fields Test',
        content: `${term} content`,
      });

      const results = await fullTextSearch(term, [], 10, 0);

      expect(results[0]).toMatchObject({
        id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        slug: expect.any(String),
        title: expect.any(String),
        authorName: expect.any(String),
        rank: expect.any(Number),
        excerpt: expect.any(String),
      });
    });
  });

  describe('countSearchResults', () => {
    it('returns the total count of matching published articles', async () => {
      const term = `countterm${Date.now()}`;
      for (let i = 1; i <= 3; i++) {
        await createPublishedArticle({
          slug: `count-art-${i}-${Date.now()}`,
          title: `Count Article ${i}`,
          content: `${term} content`,
        });
      }

      const count = await countSearchResults(term, []);
      expect(count).toBe(3);
    });

    it('returns 0 when no articles match', async () => {
      const count = await countSearchResults('zzznomatchtermever', []);
      expect(count).toBe(0);
    });

    it('does not count soft-deleted articles', async () => {
      const term = `countdelterm${Date.now()}`;
      const id = await createPublishedArticle({
        slug: `count-del-${Date.now()}`,
        title: `Count Deleted ${term}`,
        content: `${term} content`,
      });
      await prisma.article.update({ where: { id }, data: { deletedAt: new Date() } });

      const count = await countSearchResults(term, []);
      expect(count).toBe(0);
    });

    it('does not count DRAFT articles', async () => {
      const term = `countdraftterm${Date.now()}`;
      await prisma.article.create({
        data: {
          slug: `count-draft-${Date.now()}`,
          title: `Count Draft ${term}`,
          content: `${term} content`,
          status: ArticleStatus.DRAFT,
          authorId,
        },
      });

      const count = await countSearchResults(term, []);
      expect(count).toBe(0);
    });

    it('counts only tag-filtered articles when tag slugs provided', async () => {
      const term = `counttagterm${Date.now()}`;
      const tag = await prisma.tag.create({
        data: { name: `Count Tag ${Date.now()}`, slug: `count-tag-${Date.now()}` },
        select: { id: true, slug: true },
      });

      const taggedId = await createPublishedArticle({
        slug: `tagged-count-${Date.now()}`,
        title: `Tagged Count ${term}`,
        content: `${term}`,
      });
      await prisma.articleTag.create({ data: { articleId: taggedId, tagId: tag.id } });

      await createPublishedArticle({
        slug: `untagged-count-${Date.now()}`,
        title: `Untagged Count ${term}`,
        content: `${term}`,
      });

      const count = await countSearchResults(term, [tag.slug]);
      expect(count).toBe(1);
    });
  });
});
