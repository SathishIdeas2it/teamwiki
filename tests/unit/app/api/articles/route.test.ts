/**
 * @jest-environment node
 */
// Mock auth before any module that triggers next-auth initialisation
jest.mock('@/lib/auth/config', () => ({ auth: jest.fn() }));

jest.mock('@/lib/services/articles', () => ({
  listArticles: jest.fn(),
  createArticle: jest.fn(),
}));

import { GET, POST } from '@/app/api/articles/route';
import { auth } from '@/lib/auth/config';
import { listArticles, createArticle } from '@/lib/services/articles';
import { ArticleStatus, Role } from '@prisma/client';
import { ForbiddenError } from '@/lib/errors';
import type { AppSession } from '@/types';

const mockAuth = auth as jest.Mock;
const mockListArticles = listArticles as jest.Mock;
const mockCreateArticle = createArticle as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(role: Role): AppSession {
  return {
    user: { id: 'user-uuid-1', email: 'test@example.com', name: 'Test User', role },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

function makeArticleSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: 'article-uuid-1',
    slug: 'test-article',
    title: 'Test Article',
    status: ArticleStatus.PUBLISHED,
    publishedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    author: { id: 'user-uuid-1', name: 'Test User' },
    tags: [],
    ...overrides,
  };
}

function makeArticleDetail(overrides: Record<string, unknown> = {}) {
  return { ...makeArticleSummary(), content: 'Article content body', revisionCount: 1, ...overrides };
}

function makePaginated(data: unknown[] = [], total = 0) {
  return {
    data,
    meta: { total, page: 1, limit: 20, totalPages: Math.ceil(total / 20) },
  };
}

// ─── GET /api/articles ────────────────────────────────────────────────────────

describe('GET /api/articles', () => {
  it('returns 401 when the request has no session', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET(new Request('http://localhost/api/articles'));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 200 with paginated articles for an authenticated user', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.VIEWER));
    mockListArticles.mockResolvedValueOnce(makePaginated([makeArticleSummary()], 1));

    const res = await GET(new Request('http://localhost/api/articles'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.meta.total).toBe(1);
    expect(body.data[0].slug).toBe('test-article');
  });

  it('returns 422 when query parameters fail validation', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.VIEWER));

    // page must be >= 1
    const res = await GET(new Request('http://localhost/api/articles?page=0'));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
  });

  it('returns 422 when limit exceeds the maximum allowed value', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.VIEWER));

    const res = await GET(new Request('http://localhost/api/articles?limit=999'));

    expect(res.status).toBe(422);
  });

  it('forwards page and limit to the service', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.ADMIN));
    mockListArticles.mockResolvedValueOnce(makePaginated([], 0));

    await GET(new Request('http://localhost/api/articles?page=3&limit=5'));

    expect(mockListArticles).toHaveBeenCalledWith(
      expect.objectContaining({ page: 3, limit: 5 }),
      expect.anything(),
    );
  });

  it('forwards a status filter to the service when provided', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.ADMIN));
    mockListArticles.mockResolvedValueOnce(makePaginated());

    await GET(new Request(`http://localhost/api/articles?status=${ArticleStatus.DRAFT}`));

    expect(mockListArticles).toHaveBeenCalledWith(
      expect.objectContaining({ status: ArticleStatus.DRAFT }),
      expect.anything(),
    );
  });

  it('forwards an authorId filter to the service when provided', async () => {
    const authorId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    mockAuth.mockResolvedValueOnce(makeSession(Role.ADMIN));
    mockListArticles.mockResolvedValueOnce(makePaginated());

    await GET(new Request(`http://localhost/api/articles?authorId=${authorId}`));

    expect(mockListArticles).toHaveBeenCalledWith(
      expect.objectContaining({ authorId }),
      expect.anything(),
    );
  });

  it('passes the resolved session to the service', async () => {
    const session = makeSession(Role.EDITOR);
    mockAuth.mockResolvedValueOnce(session);
    mockListArticles.mockResolvedValueOnce(makePaginated());

    await GET(new Request('http://localhost/api/articles'));

    expect(mockListArticles).toHaveBeenCalledWith(expect.anything(), session);
  });

  it('returns 500 when the service throws an unexpected error', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.VIEWER));
    mockListArticles.mockRejectedValueOnce(new Error('Unexpected DB failure'));

    const res = await GET(new Request('http://localhost/api/articles'));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    // Internal error messages must not leak to the client
    expect(body.error.message).not.toContain('Unexpected DB failure');
  });
});

// ─── POST /api/articles ───────────────────────────────────────────────────────

describe('POST /api/articles', () => {
  function makePostRequest(body: unknown) {
    return new Request('http://localhost/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns 401 when the request has no session', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await POST(makePostRequest({ title: 'T', content: 'C', tagIds: [] }));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 201 with the created article', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.EDITOR));
    mockCreateArticle.mockResolvedValueOnce(makeArticleDetail({ status: ArticleStatus.DRAFT }));

    const res = await POST(
      makePostRequest({ title: 'New Article', content: 'Body content', tagIds: [] }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.slug).toBe('test-article');
    expect(body.content).toBe('Article content body');
  });

  it('returns 422 when title is missing', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.EDITOR));

    const res = await POST(makePostRequest({ content: 'No title', tagIds: [] }));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
  });

  it('returns 422 when content is missing', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.EDITOR));

    const res = await POST(makePostRequest({ title: 'Title Only', tagIds: [] }));

    expect(res.status).toBe(422);
  });

  it('returns 422 when title is an empty string', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.EDITOR));

    const res = await POST(makePostRequest({ title: '', content: 'Body', tagIds: [] }));

    expect(res.status).toBe(422);
  });

  it('returns 422 when tagIds contains a non-UUID string', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.EDITOR));

    const res = await POST(
      makePostRequest({ title: 'T', content: 'C', tagIds: ['not-a-uuid'] }),
    );

    expect(res.status).toBe(422);
  });

  it('returns 403 when the service throws ForbiddenError (VIEWER creating article)', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.VIEWER));
    mockCreateArticle.mockRejectedValueOnce(new ForbiddenError('Insufficient permissions'));

    const res = await POST(makePostRequest({ title: 'T', content: 'C', tagIds: [] }));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('passes the parsed body to createArticle', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.EDITOR));
    mockCreateArticle.mockResolvedValueOnce(makeArticleDetail());

    await POST(
      makePostRequest({
        title: 'Specific Title',
        content: 'Specific content',
        tagIds: [],
        status: ArticleStatus.PUBLISHED,
        changeSummary: 'Initial draft',
      }),
    );

    expect(mockCreateArticle).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Specific Title',
        content: 'Specific content',
        status: ArticleStatus.PUBLISHED,
        changeSummary: 'Initial draft',
      }),
      expect.anything(),
    );
  });

  it('defaults tagIds to empty array when not provided', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.EDITOR));
    mockCreateArticle.mockResolvedValueOnce(makeArticleDetail());

    await POST(makePostRequest({ title: 'T', content: 'C' }));

    expect(mockCreateArticle).toHaveBeenCalledWith(
      expect.objectContaining({ tagIds: [] }),
      expect.anything(),
    );
  });

  it('defaults status to DRAFT when not provided', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.EDITOR));
    mockCreateArticle.mockResolvedValueOnce(makeArticleDetail());

    await POST(makePostRequest({ title: 'T', content: 'C', tagIds: [] }));

    expect(mockCreateArticle).toHaveBeenCalledWith(
      expect.objectContaining({ status: ArticleStatus.DRAFT }),
      expect.anything(),
    );
  });

  it('returns 500 when the service throws an unexpected error', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.EDITOR));
    mockCreateArticle.mockRejectedValueOnce(new Error('DB write failed'));

    const res = await POST(makePostRequest({ title: 'T', content: 'C', tagIds: [] }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
