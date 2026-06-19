/**
 * @jest-environment node
 */
jest.mock('@/lib/auth/config', () => ({ auth: jest.fn() }));

jest.mock('@/lib/services/revisions', () => ({
  findById: jest.fn(),
}));

import { GET } from '@/app/api/revisions/[revisionId]/route';
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
    revisionNumber: 3,
    title: 'Article Title v3',
    content: 'Content at revision 3',
    authorName: 'Test User',
    changeSummary: 'Updated introduction',
    createdAt: new Date('2024-01-03'),
    ...overrides,
  };
}

function makeCtx(revisionId: string) {
  return { params: Promise.resolve({ revisionId }) };
}

// ─── GET /api/revisions/[revisionId] ─────────────────────────────────────────

describe('GET /api/revisions/[revisionId]', () => {
  it('returns 401 when the request has no session', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET(
      new Request('http://localhost/api/revisions/rev-uuid-1'),
      makeCtx('rev-uuid-1'),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 200 with the full revision detail', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());
    mockFindById.mockResolvedValueOnce(makeRevisionDetail());

    const res = await GET(
      new Request('http://localhost/api/revisions/rev-uuid-1'),
      makeCtx('rev-uuid-1'),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('rev-uuid-1');
    expect(body.title).toBe('Article Title v3');
    expect(body.content).toBe('Content at revision 3');
    expect(body.revisionNumber).toBe(3);
    expect(body.authorName).toBe('Test User');
    expect(body.changeSummary).toBe('Updated introduction');
  });

  it('returns 404 when the revision does not exist', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());
    mockFindById.mockRejectedValueOnce(new NotFoundError('Revision not found'));

    const res = await GET(
      new Request('http://localhost/api/revisions/ghost-rev-id'),
      makeCtx('ghost-rev-id'),
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
      new Request('http://localhost/api/revisions/specific-rev-id'),
      makeCtx('specific-rev-id'),
    );

    expect(mockFindById).toHaveBeenCalledWith('specific-rev-id', session);
  });

  it('passes the resolved session to findById', async () => {
    const session = makeSession(Role.ADMIN);
    mockAuth.mockResolvedValueOnce(session);
    mockFindById.mockResolvedValueOnce(makeRevisionDetail());

    await GET(
      new Request('http://localhost/api/revisions/rev-uuid-1'),
      makeCtx('rev-uuid-1'),
    );

    expect(mockFindById).toHaveBeenCalledWith(expect.anything(), session);
  });

  it('returns 500 when the service throws an unexpected error', async () => {
    mockAuth.mockResolvedValueOnce(makeSession());
    mockFindById.mockRejectedValueOnce(new Error('Connection pool exhausted'));

    const res = await GET(
      new Request('http://localhost/api/revisions/rev-uuid-1'),
      makeCtx('rev-uuid-1'),
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('Connection pool exhausted');
  });
});
