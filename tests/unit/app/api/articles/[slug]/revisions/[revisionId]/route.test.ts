/**
 * @jest-environment node
 */
jest.mock('@/lib/auth/config', () => ({ auth: jest.fn() }));

jest.mock('@/lib/services/revisions', () => ({
  findById: jest.fn(),
}));

import { GET } from '@/app/api/articles/[slug]/revisions/[revisionId]/route';
import { auth } from '@/lib/auth/config';
import { findById } from '@/lib/services/revisions';
import { Role } from '@prisma/client';
import { NotFoundError } from '@/lib/errors';
import type { AppSession } from '@/types';

const mockAuth = auth as jest.Mock;
const mockFindById = findById as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(role: Role = Role.VIEWER): AppSession {
  return {
    user: { id: 'user-uuid-1', email: 'test@example.com', name: 'Test User', role },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

function makeRevisionDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rev-uuid-1',
    revisionNumber: 2,
    title: 'Article Title v2',
    content: 'Content at revision 2',
    authorName: 'Test User',
    changeSummary: 'Fixed typos',
    createdAt: new Date('2024-01-02'),
    ...overrides,
  };
}

function makeCtx(slug: string, revisionId: string) {
  return { params: Promise.resolve({ slug, revisionId }) };
}

// ─── GET /api/articles/[slug]/revisions/[revisionId] ─────────────────────────

describe('GET /api/articles/[slug]/revisions/[revisionId]', () => {
  it('returns 401 when the request has no session', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET(
      new Request('http://localhost/api/articles/test-article/revisions/rev-uuid-1'),
      makeCtx('test-article', 'rev-uuid-1'),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 200 with the full revision detail', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());
    mockFindById.mockResolvedValueOnce(makeRevisionDetail());

    const res = await GET(
      new Request('http://localhost/api/articles/test-article/revisions/rev-uuid-1'),
      makeCtx('test-article', 'rev-uuid-1'),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('rev-uuid-1');
    expect(body.title).toBe('Article Title v2');
    expect(body.content).toBe('Content at revision 2');
    expect(body.revisionNumber).toBe(2);
    expect(body.authorName).toBe('Test User');
    expect(body.changeSummary).toBe('Fixed typos');
  });

  it('returns 404 when the revision does not exist', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());
    mockFindById.mockRejectedValueOnce(new NotFoundError('Revision not found'));

    const res = await GET(
      new Request('http://localhost/api/articles/test-article/revisions/ghost-rev'),
      makeCtx('test-article', 'ghost-rev'),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('passes the revisionId and session to findById', async () => {
    const session = makeSession(Role.EDITOR);
    mockAuth.mockResolvedValueOnce(session);
    mockFindById.mockResolvedValueOnce(makeRevisionDetail());

    await GET(
      new Request('http://localhost/api/articles/test-article/revisions/specific-rev-id'),
      makeCtx('test-article', 'specific-rev-id'),
    );

    expect(mockFindById).toHaveBeenCalledWith('specific-rev-id', session);
  });

  it('does not use the slug parameter (findById is self-contained)', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());
    mockFindById.mockResolvedValueOnce(makeRevisionDetail());

    await GET(
      new Request('http://localhost/api/articles/any-slug/revisions/rev-uuid-1'),
      makeCtx('any-slug', 'rev-uuid-1'),
    );

    // findById does not receive the slug — it only needs the revisionId
    expect(mockFindById).toHaveBeenCalledWith('rev-uuid-1', expect.anything());
    expect(mockFindById).not.toHaveBeenCalledWith(expect.stringContaining('slug'), expect.anything());
  });

  it('returns 500 when the service throws an unexpected error', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());
    mockFindById.mockRejectedValueOnce(new Error('DB unavailable'));

    const res = await GET(
      new Request('http://localhost/api/articles/test-article/revisions/rev-uuid-1'),
      makeCtx('test-article', 'rev-uuid-1'),
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('DB unavailable');
  });
});
