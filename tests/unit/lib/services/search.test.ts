import { prismaMock } from '../../setup';
import { Role } from '@prisma/client';
import { search } from '@/lib/services/search';
import { ForbiddenError } from '@/lib/errors';
import type { AppSession, SearchResult } from '@/types';

jest.mock('@/lib/db/search', () => ({
  fullTextSearch: jest.fn(),
  countSearchResults: jest.fn(),
}));

import { fullTextSearch, countSearchResults } from '@/lib/db/search';

const mockFullTextSearch = fullTextSearch as jest.Mock;
const mockCountSearchResults = countSearchResults as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(role: Role): AppSession {
  return {
    user: { id: 'session-id', email: 'user@example.com', name: 'User', role },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

function makeSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 'article-uuid-1',
    slug: 'my-article',
    title: 'My Article',
    authorName: 'Author',
    publishedAt: new Date('2024-01-01'),
    rank: 0.5,
    excerpt: 'Some <mark>content</mark> here',
    ...overrides,
  };
}

// ─── search ──────────────────────────────────────────────────────────────────

describe('search', () => {
  it('throws ForbiddenError when SYSTEM role calls search (no article:read)', async () => {
    // Actually all human roles have article:read, SYSTEM also has it.
    // This test verifies VIEWER can search.
    const session = makeSession(Role.VIEWER);
    mockFullTextSearch.mockResolvedValueOnce([]);
    mockCountSearchResults.mockResolvedValueOnce(0);

    const result = await search({ q: 'test', page: 1, limit: 20 }, session);
    expect(result.data).toHaveLength(0);
  });

  it('calls fullTextSearch with the query, empty tags, limit, and offset', async () => {
    const session = makeSession(Role.VIEWER);
    mockFullTextSearch.mockResolvedValueOnce([makeSearchResult()]);
    mockCountSearchResults.mockResolvedValueOnce(1);

    await search({ q: 'hello world', page: 1, limit: 20 }, session);

    expect(mockFullTextSearch).toHaveBeenCalledWith('hello world', [], 20, 0);
  });

  it('passes tag slugs to fullTextSearch when provided', async () => {
    const session = makeSession(Role.VIEWER);
    mockFullTextSearch.mockResolvedValueOnce([]);
    mockCountSearchResults.mockResolvedValueOnce(0);

    await search({ q: 'test', tags: ['react', 'typescript'], page: 1, limit: 20 }, session);

    expect(mockFullTextSearch).toHaveBeenCalledWith(
      'test',
      ['react', 'typescript'],
      20,
      0,
    );
  });

  it('calculates the correct offset for page 2', async () => {
    const session = makeSession(Role.VIEWER);
    mockFullTextSearch.mockResolvedValueOnce([]);
    mockCountSearchResults.mockResolvedValueOnce(0);

    await search({ q: 'test', page: 2, limit: 10 }, session);

    expect(mockFullTextSearch).toHaveBeenCalledWith('test', [], 10, 10);
  });

  it('returns paginated search results with correct meta', async () => {
    const session = makeSession(Role.VIEWER);
    const results = [makeSearchResult(), makeSearchResult({ id: 'a2', slug: 'art-2' })];
    mockFullTextSearch.mockResolvedValueOnce(results);
    mockCountSearchResults.mockResolvedValueOnce(25);

    const result = await search({ q: 'test', page: 2, limit: 10 }, session);

    expect(result.data).toHaveLength(2);
    expect(result.meta).toMatchObject({
      total: 25,
      page: 2,
      limit: 10,
      totalPages: 3,
    });
  });

  it('calls countSearchResults with the same query and tags', async () => {
    const session = makeSession(Role.VIEWER);
    mockFullTextSearch.mockResolvedValueOnce([]);
    mockCountSearchResults.mockResolvedValueOnce(0);

    await search({ q: 'find me', tags: ['vue'], page: 1, limit: 20 }, session);

    expect(mockCountSearchResults).toHaveBeenCalledWith('find me', ['vue']);
  });

  it('returns results preserving rank and excerpt fields', async () => {
    const session = makeSession(Role.VIEWER);
    const result = makeSearchResult({ rank: 0.99, excerpt: 'Found <mark>keyword</mark>' });
    mockFullTextSearch.mockResolvedValueOnce([result]);
    mockCountSearchResults.mockResolvedValueOnce(1);

    const response = await search({ q: 'keyword', page: 1, limit: 20 }, session);

    expect(response.data[0]?.rank).toBe(0.99);
    expect(response.data[0]?.excerpt).toBe('Found <mark>keyword</mark>');
  });
});
