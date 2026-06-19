/**
 * @jest-environment node
 */
// Mock auth before any module that triggers next-auth initialisation
jest.mock('@/lib/auth/config', () => ({ auth: jest.fn() }));

jest.mock('@/lib/services/search', () => ({
  search: jest.fn(),
}));

import { GET } from '@/app/api/search/route';
import { auth } from '@/lib/auth/config';
import { search } from '@/lib/services/search';
import { Role } from '@prisma/client';
import type { AppSession } from '@/types';

const mockAuth = auth as jest.Mock;
const mockSearch = search as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(role: Role = Role.VIEWER): AppSession {
  return {
    user: { id: 'user-uuid-1', email: 'test@example.com', name: 'Test User', role },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

function makeSearchResult(overrides: Record<string, unknown> = {}) {
  return {
    id: 'article-uuid-1',
    slug: 'typescript-guide',
    title: 'TypeScript Guide',
    authorName: 'Test User',
    publishedAt: new Date('2024-01-01').toISOString(),
    rank: 0.5,
    excerpt: 'An overview of <mark>TypeScript</mark> features.',
    ...overrides,
  };
}

function makePaginatedResults(data: unknown[] = [], total = 0) {
  return {
    data,
    meta: { total, page: 1, limit: 20, totalPages: Math.ceil(total / 20) || 0 },
  };
}

// ─── GET /api/search ──────────────────────────────────────────────────────────

describe('GET /api/search', () => {
  it('returns 401 when the request has no session', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET(new Request('http://localhost/api/search?q=typescript'));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 200 with paginated search results for an authenticated user', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());
    mockSearch.mockResolvedValueOnce(makePaginatedResults([makeSearchResult()], 1));

    const res = await GET(new Request('http://localhost/api/search?q=typescript'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.meta.total).toBe(1);
    expect(body.data[0].slug).toBe('typescript-guide');
  });

  it('includes the query string in the response body', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());
    mockSearch.mockResolvedValueOnce(makePaginatedResults());

    const res = await GET(new Request('http://localhost/api/search?q=kubernetes'));

    const body = await res.json();
    expect(body.query).toBe('kubernetes');
  });

  it('returns 422 when q is missing', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());

    const res = await GET(new Request('http://localhost/api/search'));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
  });

  it('returns 422 when q is an empty string', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());

    const res = await GET(new Request('http://localhost/api/search?q='));

    expect(res.status).toBe(422);
  });

  it('returns 422 when limit exceeds the maximum allowed value of 50', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());

    const res = await GET(new Request('http://localhost/api/search?q=test&limit=51'));

    expect(res.status).toBe(422);
  });

  it('returns 422 when page is less than 1', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());

    const res = await GET(new Request('http://localhost/api/search?q=test&page=0'));

    expect(res.status).toBe(422);
  });

  it('forwards q to the search service', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());
    mockSearch.mockResolvedValueOnce(makePaginatedResults());

    await GET(new Request('http://localhost/api/search?q=react+hooks'));

    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'react hooks' }),
      expect.anything(),
    );
  });

  it('forwards page and limit to the search service', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());
    mockSearch.mockResolvedValueOnce(makePaginatedResults());

    await GET(new Request('http://localhost/api/search?q=test&page=2&limit=10'));

    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 10 }),
      expect.anything(),
    );
  });

  it('forwards tag slugs to the search service as an array', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());
    mockSearch.mockResolvedValueOnce(makePaginatedResults());

    await GET(new Request('http://localhost/api/search?q=test&tags=typescript,react'));

    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['typescript', 'react'] }),
      expect.anything(),
    );
  });

  it('passes an empty tags array to the service when tags param is absent', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());
    mockSearch.mockResolvedValueOnce(makePaginatedResults());

    await GET(new Request('http://localhost/api/search?q=test'));

    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ tags: [] }),
      expect.anything(),
    );
  });

  it('passes the resolved session to the search service', async () => {
    const session = makeSession(Role.EDITOR);
    mockAuth.mockResolvedValueOnce(session);
    mockSearch.mockResolvedValueOnce(makePaginatedResults());

    await GET(new Request('http://localhost/api/search?q=test'));

    expect(mockSearch).toHaveBeenCalledWith(expect.anything(), session);
  });

  it('uses default page=1 and limit=20 when not provided', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());
    mockSearch.mockResolvedValueOnce(makePaginatedResults());

    await GET(new Request('http://localhost/api/search?q=test'));

    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
      expect.anything(),
    );
  });

  it('returns 500 when the service throws an unexpected error', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());
    mockSearch.mockRejectedValueOnce(new Error('Unexpected DB failure'));

    const res = await GET(new Request('http://localhost/api/search?q=test'));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('Unexpected DB failure');
  });
});
