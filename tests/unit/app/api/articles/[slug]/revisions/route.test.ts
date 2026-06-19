/**
 * @jest-environment node
 */
jest.mock('@/lib/auth/config', () => ({ auth: jest.fn() }));

jest.mock('@/lib/services/articles', () => ({
  getArticleBySlug: jest.fn(),
}));

jest.mock('@/lib/services/revisions', () => ({
  listByArticle: jest.fn(),
}));

import { GET } from '@/app/api/articles/[slug]/revisions/route';
import { auth } from '@/lib/auth/config';
import { getArticleBySlug } from '@/lib/services/articles';
import { listByArticle } from '@/lib/services/revisions';
import { Role } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import type { AppSession } from '@/types';

const mockAuth = auth as jest.Mock;
const mockGetArticle = getArticleBySlug as jest.Mock;
const mockListByArticle = listByArticle as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(role: Role = Role.VIEWER): AppSession {
  return {
    user: { id: 'user-uuid-1', email: 'test@example.com', name: 'Test User', role },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

function makeArticle(id = 'article-uuid-1') {
  return {
    id,
    slug: 'test-article',
    title: 'Test Article',
    content: 'Article body',
    status: 'PUBLISHED',
    publishedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    author: { id: 'user-uuid-1', name: 'Test User' },
    tags: [],
    revisionCount: 3,
  };
}

function makeRevisionSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rev-uuid-1',
    revisionNumber: 1,
    authorName: 'Test User',
    changeSummary: null,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeCtx(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

// ─── GET /api/articles/[slug]/revisions ───────────────────────────────────────

describe('GET /api/articles/[slug]/revisions', () => {
  it('returns 401 when the request has no session', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET(
      new Request('http://localhost/api/articles/test-article/revisions'),
      makeCtx('test-article'),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 200 with a revisions array', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());
    mockGetArticle.mockResolvedValueOnce(makeArticle());
    mockListByArticle.mockResolvedValueOnce([
      makeRevisionSummary({ revisionNumber: 3 }),
      makeRevisionSummary({ id: 'rev-2', revisionNumber: 2 }),
      makeRevisionSummary({ id: 'rev-1', revisionNumber: 1 }),
    ]);

    const res = await GET(
      new Request('http://localhost/api/articles/test-article/revisions'),
      makeCtx('test-article'),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revisions).toHaveLength(3);
    expect(body.revisions[0].revisionNumber).toBe(3);
  });

  it('returns an empty revisions array when the article has no revisions', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());
    mockGetArticle.mockResolvedValueOnce(makeArticle());
    mockListByArticle.mockResolvedValueOnce([]);

    const res = await GET(
      new Request('http://localhost/api/articles/test-article/revisions'),
      makeCtx('test-article'),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revisions).toHaveLength(0);
  });

  it('returns 404 when the article does not exist', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());
    mockGetArticle.mockRejectedValueOnce(new NotFoundError('Article not found'));

    const res = await GET(
      new Request('http://localhost/api/articles/ghost-article/revisions'),
      makeCtx('ghost-article'),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when the user cannot access the article', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.VIEWER));
    mockGetArticle.mockRejectedValueOnce(new ForbiddenError('Access denied'));

    const res = await GET(
      new Request('http://localhost/api/articles/draft-article/revisions'),
      makeCtx('draft-article'),
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('passes the slug and session to getArticleBySlug', async () => {
    const session = makeSession(Role.EDITOR);
    mockAuth.mockResolvedValueOnce(session);
    mockGetArticle.mockResolvedValueOnce(makeArticle());
    mockListByArticle.mockResolvedValueOnce([]);

    await GET(
      new Request('http://localhost/api/articles/my-article/revisions'),
      makeCtx('my-article'),
    );

    expect(mockGetArticle).toHaveBeenCalledWith('my-article', session);
  });

  it('passes the article id and session to listByArticle', async () => {
    const session = makeSession();
    const article = makeArticle('specific-article-id');
    mockAuth.mockResolvedValueOnce(session);
    mockGetArticle.mockResolvedValueOnce(article);
    mockListByArticle.mockResolvedValueOnce([]);

    await GET(
      new Request('http://localhost/api/articles/test-article/revisions'),
      makeCtx('test-article'),
    );

    expect(mockListByArticle).toHaveBeenCalledWith('specific-article-id', session);
  });

  it('returns 500 when the service throws an unexpected error', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());
    mockGetArticle.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await GET(
      new Request('http://localhost/api/articles/test-article/revisions'),
      makeCtx('test-article'),
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('DB connection lost');
  });
});
