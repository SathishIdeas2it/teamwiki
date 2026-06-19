/**
 * @jest-environment node
 */
jest.mock('@/lib/auth/config', () => ({ auth: jest.fn() }));

jest.mock('@/lib/services/articles', () => ({
  getArticleBySlug: jest.fn(),
  updateArticle: jest.fn(),
  deleteArticle: jest.fn(),
}));

import { GET, PATCH, DELETE } from '@/app/api/articles/[slug]/route';
import { auth } from '@/lib/auth/config';
import { getArticleBySlug, updateArticle, deleteArticle } from '@/lib/services/articles';
import { ArticleStatus, Role } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import type { AppSession } from '@/types';

const mockAuth = auth as jest.Mock;
const mockGet = getArticleBySlug as jest.Mock;
const mockUpdate = updateArticle as jest.Mock;
const mockDelete = deleteArticle as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(role: Role): AppSession {
  return {
    user: { id: 'user-uuid-1', email: 'test@example.com', name: 'Test User', role },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

function makeArticle(overrides: Record<string, unknown> = {}) {
  return {
    id: 'article-uuid-1',
    slug: 'test-article',
    title: 'Test Article',
    content: 'Article body content',
    status: ArticleStatus.PUBLISHED,
    publishedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    author: { id: 'user-uuid-1', name: 'Test User' },
    tags: [],
    revisionCount: 1,
    ...overrides,
  };
}

function makeCtx(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

// ─── GET /api/articles/[slug] ─────────────────────────────────────────────────

describe('GET /api/articles/[slug]', () => {
  it('returns 401 when the request has no session', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET(
      new Request('http://localhost/api/articles/test'),
      makeCtx('test'),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 200 with the full article including content', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.VIEWER));
    mockGet.mockResolvedValueOnce(makeArticle());

    const res = await GET(
      new Request('http://localhost/api/articles/test-article'),
      makeCtx('test-article'),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe('test-article');
    expect(body.content).toBe('Article body content');
    expect(body.revisionCount).toBe(1);
  });

  it('passes the slug from route params to the service', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.VIEWER));
    mockGet.mockResolvedValueOnce(makeArticle({ slug: 'specific-slug' }));

    await GET(
      new Request('http://localhost/api/articles/specific-slug'),
      makeCtx('specific-slug'),
    );

    expect(mockGet).toHaveBeenCalledWith('specific-slug', expect.anything());
  });

  it('passes the resolved session to the service', async () => {
    const session = makeSession(Role.EDITOR);
    mockAuth.mockResolvedValueOnce(session);
    mockGet.mockResolvedValueOnce(makeArticle());

    await GET(
      new Request('http://localhost/api/articles/test-article'),
      makeCtx('test-article'),
    );

    expect(mockGet).toHaveBeenCalledWith(expect.anything(), session);
  });

  it('returns 404 when the service throws NotFoundError', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.VIEWER));
    mockGet.mockRejectedValueOnce(new NotFoundError('Article not found'));

    const res = await GET(
      new Request('http://localhost/api/articles/missing'),
      makeCtx('missing'),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Article not found');
  });

  it('returns 403 when the service throws ForbiddenError (draft access denied)', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.VIEWER));
    mockGet.mockRejectedValueOnce(new ForbiddenError('You do not have access to this draft'));

    const res = await GET(
      new Request('http://localhost/api/articles/draft-slug'),
      makeCtx('draft-slug'),
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

// ─── PATCH /api/articles/[slug] ───────────────────────────────────────────────

describe('PATCH /api/articles/[slug]', () => {
  function makePatchRequest(slug: string, body: unknown) {
    return new Request(`http://localhost/api/articles/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns 401 when the request has no session', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await PATCH(
      makePatchRequest('test', { title: 'Updated' }),
      makeCtx('test'),
    );

    expect(res.status).toBe(401);
  });

  it('returns 200 with the updated article', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.EDITOR));
    mockUpdate.mockResolvedValueOnce(makeArticle({ title: 'Updated Title' }));

    const res = await PATCH(
      makePatchRequest('test-article', { title: 'Updated Title' }),
      makeCtx('test-article'),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Updated Title');
  });

  it('returns 422 when title is an empty string', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.EDITOR));

    const res = await PATCH(
      makePatchRequest('test', { title: '' }),
      makeCtx('test'),
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
  });

  it('returns 422 when content is an empty string', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.EDITOR));

    const res = await PATCH(
      makePatchRequest('test', { content: '' }),
      makeCtx('test'),
    );

    expect(res.status).toBe(422);
  });

  it('returns 422 when status is an invalid value', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.EDITOR));

    const res = await PATCH(
      makePatchRequest('test', { status: 'INVALID_STATUS' }),
      makeCtx('test'),
    );

    expect(res.status).toBe(422);
  });

  it('passes slug and parsed body to the service', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.EDITOR));
    mockUpdate.mockResolvedValueOnce(makeArticle());

    await PATCH(
      makePatchRequest('my-slug', {
        content: 'New content',
        changeSummary: 'Fixed typo in intro',
      }),
      makeCtx('my-slug'),
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      'my-slug',
      expect.objectContaining({ content: 'New content', changeSummary: 'Fixed typo in intro' }),
      expect.anything(),
    );
  });

  it('returns 403 when the service throws ForbiddenError', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.EDITOR));
    mockUpdate.mockRejectedValueOnce(new ForbiddenError('You cannot edit this article'));

    const res = await PATCH(
      makePatchRequest('test', { title: 'Hijacked' }),
      makeCtx('test'),
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when the service throws NotFoundError', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.EDITOR));
    mockUpdate.mockRejectedValueOnce(new NotFoundError('Article not found'));

    const res = await PATCH(
      makePatchRequest('ghost', { title: 'Updated' }),
      makeCtx('ghost'),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('accepts a body with only a subset of fields (partial update)', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.EDITOR));
    mockUpdate.mockResolvedValueOnce(makeArticle({ status: ArticleStatus.PUBLISHED }));

    const res = await PATCH(
      makePatchRequest('test', { status: ArticleStatus.PUBLISHED }),
      makeCtx('test'),
    );

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({ status: ArticleStatus.PUBLISHED }),
      expect.anything(),
    );
  });
});

// ─── DELETE /api/articles/[slug] ──────────────────────────────────────────────

describe('DELETE /api/articles/[slug]', () => {
  function makeDeleteRequest(slug: string) {
    return new Request(`http://localhost/api/articles/${slug}`, { method: 'DELETE' });
  }

  it('returns 401 when the request has no session', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await DELETE(makeDeleteRequest('test'), makeCtx('test'));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 204 with no body when the article is deleted', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.ADMIN));
    mockDelete.mockResolvedValueOnce(undefined);

    const res = await DELETE(makeDeleteRequest('test-article'), makeCtx('test-article'));

    expect(res.status).toBe(204);
    // 204 responses must have no body
    expect(res.body).toBeNull();
  });

  it('passes the slug from route params to the service', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.ADMIN));
    mockDelete.mockResolvedValueOnce(undefined);

    await DELETE(makeDeleteRequest('target-article'), makeCtx('target-article'));

    expect(mockDelete).toHaveBeenCalledWith('target-article', expect.anything());
  });

  it('passes the resolved session to the service', async () => {
    const session = makeSession(Role.ADMIN);
    mockAuth.mockResolvedValueOnce(session);
    mockDelete.mockResolvedValueOnce(undefined);

    await DELETE(makeDeleteRequest('test'), makeCtx('test'));

    expect(mockDelete).toHaveBeenCalledWith(expect.anything(), session);
  });

  it('returns 403 when the service throws ForbiddenError (non-admin)', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.EDITOR));
    mockDelete.mockRejectedValueOnce(new ForbiddenError('Admin only'));

    const res = await DELETE(makeDeleteRequest('test'), makeCtx('test'));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when the article does not exist', async () => {
    mockAuth.mockResolvedValueOnce(makeSession(Role.ADMIN));
    mockDelete.mockRejectedValueOnce(new NotFoundError('Article not found'));

    const res = await DELETE(makeDeleteRequest('ghost'), makeCtx('ghost'));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
