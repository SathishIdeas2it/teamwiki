import { prismaMock } from '../../setup';
import { fullTextSearch, countSearchResults } from '@/lib/db/search';

// $queryRaw is a tagged template literal in Prisma; jest-mock-extended
// surfaces it as a jest.Mock so we can stub return values.
const mockQueryRaw = prismaMock.$queryRaw as jest.Mock;

describe('fullTextSearch', () => {
  describe('result mapping', () => {
    it('maps raw database rows to SearchResult shape', async () => {
      const publishedAt = new Date('2024-01-15T00:00:00Z');
      mockQueryRaw.mockResolvedValueOnce([
        {
          id: 'a1b2c3d4-0000-0000-0000-000000000001',
          slug: 'typescript-guide',
          title: 'TypeScript Guide',
          author_name: 'Alice',
          published_at: publishedAt,
          rank: 0.5,
          excerpt: 'A <mark>TypeScript</mark> guide.',
        },
      ]);

      const results = await fullTextSearch('typescript', [], 10, 0);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: 'a1b2c3d4-0000-0000-0000-000000000001',
        slug: 'typescript-guide',
        title: 'TypeScript Guide',
        authorName: 'Alice',
        publishedAt,
        rank: 0.5,
        excerpt: 'A <mark>TypeScript</mark> guide.',
      });
    });

    it('maps null published_at to null publishedAt', async () => {
      mockQueryRaw.mockResolvedValueOnce([
        {
          id: 'uuid-2',
          slug: 'draft',
          title: 'Draft',
          author_name: 'Bob',
          published_at: null,
          rank: 0.3,
          excerpt: 'excerpt',
        },
      ]);

      const results = await fullTextSearch('query', [], 10, 0);

      expect(results[0]?.publishedAt).toBeNull();
    });

    it('coerces rank to Number (Postgres may return numeric as string)', async () => {
      mockQueryRaw.mockResolvedValueOnce([
        {
          id: 'uuid-3',
          slug: 'article',
          title: 'Article',
          author_name: 'Carol',
          published_at: null,
          rank: '0.75',
          excerpt: 'excerpt',
        },
      ]);

      const results = await fullTextSearch('query', [], 10, 0);

      expect(typeof results[0]?.rank).toBe('number');
      expect(results[0]?.rank).toBe(0.75);
    });

    it('maps multiple rows preserving order', async () => {
      const rows = [
        { id: 'id-1', slug: 'first', title: 'First', author_name: 'A', published_at: null, rank: 0.9, excerpt: '' },
        { id: 'id-2', slug: 'second', title: 'Second', author_name: 'B', published_at: null, rank: 0.6, excerpt: '' },
        { id: 'id-3', slug: 'third', title: 'Third', author_name: 'C', published_at: null, rank: 0.3, excerpt: '' },
      ];
      mockQueryRaw.mockResolvedValueOnce(rows);

      const results = await fullTextSearch('query', [], 10, 0);

      expect(results.map((r) => r.slug)).toEqual(['first', 'second', 'third']);
    });
  });

  describe('edge cases', () => {
    it('returns empty array when database returns no rows', async () => {
      mockQueryRaw.mockResolvedValueOnce([]);

      const results = await fullTextSearch('nonexistent', [], 10, 0);

      expect(results).toEqual([]);
    });

    it('calls $queryRaw exactly once per invocation', async () => {
      mockQueryRaw.mockResolvedValueOnce([]);

      await fullTextSearch('query', [], 10, 0);

      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    });
  });
});

describe('countSearchResults', () => {
  it('returns count as a number', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ count: BigInt(42) }]);

    const count = await countSearchResults('test', []);

    expect(count).toBe(42);
    expect(typeof count).toBe('number');
  });

  it('returns 0 when count is 0', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]);

    const count = await countSearchResults('nothing', []);

    expect(count).toBe(0);
  });

  it('returns 0 defensively when result array is empty', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);

    const count = await countSearchResults('test', []);

    expect(count).toBe(0);
  });

  it('handles large counts correctly', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ count: BigInt(1_000_000) }]);

    const count = await countSearchResults('popular', []);

    expect(count).toBe(1_000_000);
  });

  it('calls $queryRaw exactly once per invocation', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ count: BigInt(5) }]);

    await countSearchResults('query', []);

    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });
});
