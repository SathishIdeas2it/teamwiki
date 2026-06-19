import { prismaMock } from '../../setup';
import { Role } from '@prisma/client';
import { createSnapshot, listByArticle, findById } from '@/lib/services/revisions';
import { NotFoundError } from '@/lib/errors';
import type { AppSession } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(role: Role, id = 'session-user-id'): AppSession {
  return {
    user: { id, email: 'user@example.com', name: 'User', role },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

function makeDbRevision(
  overrides: Partial<{
    id: string;
    articleId: string;
    revisionNumber: number;
    title: string;
    content: string;
    authorId: string;
    changeSummary: string | null;
    createdAt: Date;
    author: { id: string; name: string };
  }> = {},
) {
  return {
    id: 'rev-uuid-1',
    articleId: 'article-uuid-1',
    revisionNumber: 1,
    title: 'Article Title',
    content: 'Content',
    authorId: 'author-uuid-1',
    changeSummary: null,
    createdAt: new Date('2024-01-01'),
    author: { id: 'author-uuid-1', name: 'Author Name' },
    ...overrides,
  };
}

// ─── createSnapshot ──────────────────────────────────────────────────────────

describe('createSnapshot', () => {
  it('creates a revision with revisionNumber 1 when no prior revisions exist', async () => {
    const session = makeSession(Role.EDITOR, 'editor-id');
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: null } });
    prismaMock.articleRevision.create.mockResolvedValueOnce(makeDbRevision());

    await createSnapshot(
      'article-uuid-1',
      { title: 'First Title', content: 'First Content' },
      session,
      prismaMock,
    );

    expect(prismaMock.articleRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revisionNumber: 1 }),
      }),
    );
  });

  it('increments the revision number based on the current maximum', async () => {
    const session = makeSession(Role.EDITOR, 'editor-id');
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: 5 } });
    prismaMock.articleRevision.create.mockResolvedValueOnce(makeDbRevision({ revisionNumber: 6 }));

    await createSnapshot(
      'article-uuid-1',
      { title: 'Title', content: 'Content' },
      session,
      prismaMock,
    );

    expect(prismaMock.articleRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revisionNumber: 6 }),
      }),
    );
  });

  it('stores the title and content snapshot', async () => {
    const session = makeSession(Role.EDITOR, 'editor-id');
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: null } });
    prismaMock.articleRevision.create.mockResolvedValueOnce(makeDbRevision());

    await createSnapshot(
      'article-uuid-1',
      { title: 'Snapshotted Title', content: 'Snapshotted Content' },
      session,
      prismaMock,
    );

    expect(prismaMock.articleRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Snapshotted Title',
          content: 'Snapshotted Content',
        }),
      }),
    );
  });

  it('sets authorId from the session user', async () => {
    const session = makeSession(Role.EDITOR, 'session-editor-id');
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: null } });
    prismaMock.articleRevision.create.mockResolvedValueOnce(makeDbRevision());

    await createSnapshot(
      'article-uuid-1',
      { title: 'Title', content: 'Content' },
      session,
      prismaMock,
    );

    expect(prismaMock.articleRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authorId: 'session-editor-id' }),
      }),
    );
  });

  it('stores the optional changeSummary', async () => {
    const session = makeSession(Role.EDITOR, 'editor-id');
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: null } });
    prismaMock.articleRevision.create.mockResolvedValueOnce(makeDbRevision());

    await createSnapshot(
      'article-uuid-1',
      { title: 'Title', content: 'Content', changeSummary: 'Fixed typos' },
      session,
      prismaMock,
    );

    expect(prismaMock.articleRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ changeSummary: 'Fixed typos' }),
      }),
    );
  });

  it('stores null changeSummary when not provided', async () => {
    const session = makeSession(Role.EDITOR, 'editor-id');
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: null } });
    prismaMock.articleRevision.create.mockResolvedValueOnce(makeDbRevision());

    await createSnapshot(
      'article-uuid-1',
      { title: 'Title', content: 'Content' },
      session,
      prismaMock,
    );

    expect(prismaMock.articleRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ changeSummary: null }),
      }),
    );
  });
});

// ─── listByArticle ────────────────────────────────────────────────────────────

describe('listByArticle', () => {
  it('returns revisions ordered by revisionNumber descending', async () => {
    const session = makeSession(Role.VIEWER);
    prismaMock.article.findUnique.mockResolvedValueOnce({ id: 'article-uuid-1', deletedAt: null } as never);
    prismaMock.articleRevision.findMany.mockResolvedValueOnce([
      makeDbRevision({ revisionNumber: 3 }),
      makeDbRevision({ id: 'rev-2', revisionNumber: 2 }),
      makeDbRevision({ id: 'rev-1', revisionNumber: 1 }),
    ]);

    const result = await listByArticle('article-uuid-1', session);

    expect(result).toHaveLength(3);
    expect(result[0]?.revisionNumber).toBe(3);
  });

  it('throws NotFoundError when the article does not exist', async () => {
    const session = makeSession(Role.VIEWER);
    prismaMock.article.findUnique.mockResolvedValueOnce(null);

    await expect(listByArticle('ghost-id', session)).rejects.toThrow(NotFoundError);
    expect(prismaMock.articleRevision.findMany).not.toHaveBeenCalled();
  });

  it('returns RevisionSummary shape (no content field)', async () => {
    const session = makeSession(Role.VIEWER);
    prismaMock.article.findUnique.mockResolvedValueOnce({ id: 'article-uuid-1', deletedAt: null } as never);
    prismaMock.articleRevision.findMany.mockResolvedValueOnce([
      makeDbRevision({ changeSummary: 'Initial commit' }),
    ]);

    const result = await listByArticle('article-uuid-1', session);

    expect(result[0]).toMatchObject({
      id: 'rev-uuid-1',
      revisionNumber: 1,
      authorName: 'Author Name',
      changeSummary: 'Initial commit',
      createdAt: expect.any(Date),
    });
    expect(result[0]).not.toHaveProperty('content');
    expect(result[0]).not.toHaveProperty('title');
  });

  it('maps author.name to authorName in the summary', async () => {
    const session = makeSession(Role.VIEWER);
    prismaMock.article.findUnique.mockResolvedValueOnce({ id: 'article-uuid-1', deletedAt: null } as never);
    prismaMock.articleRevision.findMany.mockResolvedValueOnce([
      makeDbRevision({ author: { id: 'a-id', name: 'Jane Doe' } }),
    ]);

    const result = await listByArticle('article-uuid-1', session);

    expect(result[0]?.authorName).toBe('Jane Doe');
  });
});

// ─── findById ─────────────────────────────────────────────────────────────────

describe('findById', () => {
  it('returns RevisionDetail with title and content', async () => {
    const session = makeSession(Role.VIEWER);
    prismaMock.articleRevision.findUnique.mockResolvedValueOnce(
      makeDbRevision({ title: 'Original Title', content: 'Original Content' }),
    );

    const result = await findById('rev-uuid-1', session);

    expect(result).toMatchObject({
      id: 'rev-uuid-1',
      title: 'Original Title',
      content: 'Original Content',
      revisionNumber: 1,
      authorName: 'Author Name',
    });
  });

  it('throws NotFoundError when revision does not exist', async () => {
    const session = makeSession(Role.VIEWER);
    prismaMock.articleRevision.findUnique.mockResolvedValueOnce(null);

    await expect(findById('ghost-rev-id', session)).rejects.toThrow(NotFoundError);
  });

  it('maps author.name to authorName', async () => {
    const session = makeSession(Role.VIEWER);
    prismaMock.articleRevision.findUnique.mockResolvedValueOnce(
      makeDbRevision({ author: { id: 'a-id', name: 'John Smith' } }),
    );

    const result = await findById('rev-uuid-1', session);

    expect(result.authorName).toBe('John Smith');
  });
});
