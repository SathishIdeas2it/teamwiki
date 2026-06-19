import { prismaMock } from '../../setup';
import { ArticleStatus, Role } from '@prisma/client';
import {
  listArticles,
  getArticleBySlug,
  createArticle,
  updateArticle,
  deleteArticle,
  createFromImport,
} from '@/lib/services/articles';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import type { AppSession } from '@/types';

jest.mock('@/lib/utils/slugify', () => ({
  slugify: jest.fn((text: string) =>
    text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, ''),
  ),
  slugifyWithSuffix: jest.fn(
    (text: string, n: number) =>
      `${text
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')}-${n}`,
  ),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(role: Role, id = 'session-user-id'): AppSession {
  return {
    user: { id, email: 'user@example.com', name: 'User', role },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

function makeDbArticle(
  overrides: Partial<{
    id: string;
    slug: string;
    title: string;
    content: string;
    status: ArticleStatus;
    authorId: string;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    author: { id: string; name: string };
    tags: { tag: { id: string; name: string; slug: string } }[];
    _count: { revisions: number };
  }> = {},
) {
  return {
    id: 'article-uuid-1',
    slug: 'my-article',
    title: 'My Article',
    content: 'Content here',
    status: ArticleStatus.PUBLISHED,
    authorId: 'author-uuid-1',
    publishedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    author: { id: 'author-uuid-1', name: 'Author Name' },
    tags: [],
    _count: { revisions: 3 },
    ...overrides,
  };
}

// ─── listArticles ─────────────────────────────────────────────────────────────

describe('listArticles', () => {
  it('returns paginated articles for VIEWER (published only)', async () => {
    const session = makeSession(Role.VIEWER);
    const articles = [makeDbArticle()];
    prismaMock.$transaction.mockResolvedValueOnce([1, articles]);

    const result = await listArticles({ page: 1, limit: 20 }, session);

    expect(result.data).toHaveLength(1);
    expect(result.meta).toMatchObject({ total: 1, page: 1, limit: 20, totalPages: 1 });
  });

  it('queries with status=PUBLISHED in the where clause for VIEWER', async () => {
    const session = makeSession(Role.VIEWER);
    prismaMock.$transaction.mockResolvedValueOnce([0, []]);

    await listArticles({ page: 1, limit: 20 }, session);

    expect(prismaMock.article.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: ArticleStatus.PUBLISHED }),
      }),
    );
  });

  it('returns articles for ADMIN with no status restriction', async () => {
    const session = makeSession(Role.ADMIN);
    const articles = [
      makeDbArticle({ status: ArticleStatus.PUBLISHED }),
      makeDbArticle({ id: 'a2', slug: 'draft', status: ArticleStatus.DRAFT }),
    ];
    prismaMock.$transaction.mockResolvedValueOnce([2, articles]);

    const result = await listArticles({ page: 1, limit: 20 }, session);

    expect(result.data).toHaveLength(2);
  });

  it('calculates totalPages correctly', async () => {
    const session = makeSession(Role.ADMIN);
    prismaMock.$transaction.mockResolvedValueOnce([55, []]);

    const result = await listArticles({ page: 1, limit: 20 }, session);

    expect(result.meta.totalPages).toBe(3);
  });

  it('maps tag join records to flat TagSummary[]', async () => {
    const session = makeSession(Role.VIEWER);
    const tag = { id: 'tag-1', name: 'TypeScript', slug: 'typescript' };
    const articles = [makeDbArticle({ tags: [{ tag }] })];
    prismaMock.$transaction.mockResolvedValueOnce([1, articles]);

    const result = await listArticles({ page: 1, limit: 20 }, session);

    expect(result.data[0]?.tags).toEqual([tag]);
  });

  it('filters by authorId when provided', async () => {
    const session = makeSession(Role.ADMIN);
    prismaMock.$transaction.mockResolvedValueOnce([0, []]);

    await listArticles({ page: 1, limit: 20, authorId: 'some-author-id' }, session);

    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});

// ─── getArticleBySlug ─────────────────────────────────────────────────────────

describe('getArticleBySlug', () => {
  it('returns a published article to any authenticated user', async () => {
    const session = makeSession(Role.VIEWER);
    prismaMock.article.findUnique.mockResolvedValueOnce(makeDbArticle());

    const result = await getArticleBySlug('my-article', session);

    expect(result.slug).toBe('my-article');
  });

  it('throws NotFoundError when article does not exist', async () => {
    const session = makeSession(Role.VIEWER);
    prismaMock.article.findUnique.mockResolvedValueOnce(null);

    await expect(getArticleBySlug('ghost', session)).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError for soft-deleted articles (deletedAt filter in query)', async () => {
    const session = makeSession(Role.VIEWER);
    prismaMock.article.findUnique.mockResolvedValueOnce(null);

    await expect(getArticleBySlug('deleted-slug', session)).rejects.toThrow(NotFoundError);
    expect(prismaMock.article.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ slug: 'deleted-slug', deletedAt: null }),
      }),
    );
  });

  it('returns a draft article to its author (EDITOR)', async () => {
    const session = makeSession(Role.EDITOR, 'author-uuid-1');
    const draft = makeDbArticle({
      status: ArticleStatus.DRAFT,
      authorId: 'author-uuid-1',
    });
    prismaMock.article.findUnique.mockResolvedValueOnce(draft);

    const result = await getArticleBySlug('my-article', session);

    expect(result.status).toBe(ArticleStatus.DRAFT);
  });

  it('returns a draft article to ADMIN', async () => {
    const session = makeSession(Role.ADMIN, 'admin-id');
    const draft = makeDbArticle({
      status: ArticleStatus.DRAFT,
      authorId: 'other-author',
    });
    prismaMock.article.findUnique.mockResolvedValueOnce(draft);

    const result = await getArticleBySlug('my-article', session);

    expect(result.status).toBe(ArticleStatus.DRAFT);
  });

  it('throws ForbiddenError when VIEWER tries to read a draft', async () => {
    const session = makeSession(Role.VIEWER, 'viewer-id');
    const draft = makeDbArticle({
      status: ArticleStatus.DRAFT,
      authorId: 'other-author',
    });
    prismaMock.article.findUnique.mockResolvedValueOnce(draft);

    await expect(getArticleBySlug('draft-article', session)).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when EDITOR tries to read another user\'s draft', async () => {
    const session = makeSession(Role.EDITOR, 'editor-id');
    const draft = makeDbArticle({
      status: ArticleStatus.DRAFT,
      authorId: 'different-author',
    });
    prismaMock.article.findUnique.mockResolvedValueOnce(draft);

    await expect(getArticleBySlug('draft-article', session)).rejects.toThrow(ForbiddenError);
  });

  it('includes revisionCount and content in the returned ArticleWithDetails', async () => {
    const session = makeSession(Role.VIEWER);
    prismaMock.article.findUnique.mockResolvedValueOnce(
      makeDbArticle({ content: 'Full content here', _count: { revisions: 7 } }),
    );

    const result = await getArticleBySlug('my-article', session);

    expect(result.content).toBe('Full content here');
    expect(result.revisionCount).toBe(7);
  });
});

// ─── createArticle ───────────────────────────────────────────────────────────

describe('createArticle', () => {
  beforeEach(() => {
    prismaMock.$transaction.mockImplementation((fn) => {
      if (typeof fn === 'function') return fn(prismaMock);
      return Promise.resolve(fn);
    });
  });

  it('throws ForbiddenError when VIEWER tries to create an article', async () => {
    const session = makeSession(Role.VIEWER);

    await expect(
      createArticle({ title: 'Title', content: 'Body', tagIds: [] }, session),
    ).rejects.toThrow(ForbiddenError);
  });

  it('creates an article with the generated slug', async () => {
    const session = makeSession(Role.EDITOR, 'editor-id');
    prismaMock.article.findUnique.mockResolvedValueOnce(null); // slug is available
    const created = makeDbArticle({ slug: 'my-new-article', authorId: 'editor-id' });
    prismaMock.article.create.mockResolvedValueOnce(created);
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: null } });
    prismaMock.articleRevision.create.mockResolvedValueOnce({} as never);

    const result = await createArticle({ title: 'My New Article', content: 'Body', tagIds: [] }, session);

    expect(result.slug).toBe('my-new-article');
  });

  it('generates a slug with suffix when the base slug is already taken', async () => {
    const session = makeSession(Role.EDITOR, 'editor-id');
    const taken = makeDbArticle({ slug: 'my-article' });
    const available = makeDbArticle({ slug: 'my-article-2' });
    // First check: base slug is taken; second check: suffixed slug is free
    prismaMock.article.findUnique
      .mockResolvedValueOnce(taken)
      .mockResolvedValueOnce(null);
    prismaMock.article.create.mockResolvedValueOnce(available);
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: null } });
    prismaMock.articleRevision.create.mockResolvedValueOnce({} as never);

    const result = await createArticle({ title: 'My Article', content: 'Body', tagIds: [] }, session);

    expect(result.slug).toBe('my-article-2');
  });

  it('sets the authorId to the session user id', async () => {
    const session = makeSession(Role.EDITOR, 'author-uuid-99');
    prismaMock.article.findUnique.mockResolvedValueOnce(null);
    prismaMock.article.create.mockResolvedValueOnce(
      makeDbArticle({ authorId: 'author-uuid-99' }),
    );
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: null } });
    prismaMock.articleRevision.create.mockResolvedValueOnce({} as never);

    await createArticle({ title: 'Title', content: 'Body', tagIds: [] }, session);

    expect(prismaMock.article.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authorId: 'author-uuid-99' }),
      }),
    );
  });

  it('defaults status to DRAFT when not specified', async () => {
    const session = makeSession(Role.EDITOR, 'editor-id');
    prismaMock.article.findUnique.mockResolvedValueOnce(null);
    prismaMock.article.create.mockResolvedValueOnce(
      makeDbArticle({ status: ArticleStatus.DRAFT }),
    );
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: null } });
    prismaMock.articleRevision.create.mockResolvedValueOnce({} as never);

    await createArticle({ title: 'Title', content: 'Body', tagIds: [] }, session);

    expect(prismaMock.article.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ArticleStatus.DRAFT }),
      }),
    );
  });

  it('connects tags when tagIds are provided', async () => {
    const session = makeSession(Role.EDITOR, 'editor-id');
    prismaMock.article.findUnique.mockResolvedValueOnce(null);
    prismaMock.article.create.mockResolvedValueOnce(makeDbArticle());
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: null } });
    prismaMock.articleRevision.create.mockResolvedValueOnce({} as never);

    await createArticle(
      { title: 'Title', content: 'Body', tagIds: ['tag-1', 'tag-2'] },
      session,
    );

    expect(prismaMock.article.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tags: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({ tagId: 'tag-1' }),
              expect.objectContaining({ tagId: 'tag-2' }),
            ]),
          }),
        }),
      }),
    );
  });

  it('creates revision #1 alongside the article', async () => {
    const session = makeSession(Role.EDITOR, 'editor-id');
    prismaMock.article.findUnique.mockResolvedValueOnce(null);
    const created = makeDbArticle();
    prismaMock.article.create.mockResolvedValueOnce(created);
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: null } });
    prismaMock.articleRevision.create.mockResolvedValueOnce({} as never);

    await createArticle({ title: 'Title', content: 'Body', tagIds: [] }, session);

    expect(prismaMock.articleRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revisionNumber: 1, articleId: created.id }),
      }),
    );
  });

  it('runs the article create and revision create inside a transaction', async () => {
    const session = makeSession(Role.EDITOR, 'editor-id');
    prismaMock.article.findUnique.mockResolvedValueOnce(null);
    prismaMock.article.create.mockResolvedValueOnce(makeDbArticle());
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: null } });
    prismaMock.articleRevision.create.mockResolvedValueOnce({} as never);

    await createArticle({ title: 'Title', content: 'Body', tagIds: [] }, session);

    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it('returns ArticleWithDetails including content and revisionCount', async () => {
    const session = makeSession(Role.EDITOR, 'editor-id');
    prismaMock.article.findUnique.mockResolvedValueOnce(null);
    prismaMock.article.create.mockResolvedValueOnce(
      makeDbArticle({ content: 'Some content', _count: { revisions: 1 } }),
    );
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: null } });
    prismaMock.articleRevision.create.mockResolvedValueOnce({} as never);

    const result = await createArticle({ title: 'Title', content: 'Some content', tagIds: [] }, session);

    expect(result.content).toBe('Some content');
    expect(result.revisionCount).toBe(1);
  });
});

// ─── updateArticle ────────────────────────────────────────────────────────────

describe('updateArticle', () => {
  beforeEach(() => {
    prismaMock.$transaction.mockImplementation((fn) => {
      if (typeof fn === 'function') return fn(prismaMock);
      return Promise.resolve(fn);
    });
  });

  it('throws NotFoundError when article does not exist', async () => {
    const session = makeSession(Role.EDITOR, 'editor-id');
    prismaMock.article.findUnique.mockResolvedValueOnce(null);

    await expect(
      updateArticle('ghost-slug', { title: 'New Title' }, session),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when EDITOR tries to update another author\'s article', async () => {
    const session = makeSession(Role.EDITOR, 'editor-id');
    prismaMock.article.findUnique.mockResolvedValueOnce(
      makeDbArticle({ authorId: 'other-author' }),
    );

    await expect(
      updateArticle('my-article', { title: 'New Title' }, session),
    ).rejects.toThrow(ForbiddenError);
  });

  it('allows EDITOR to update their own article', async () => {
    const session = makeSession(Role.EDITOR, 'editor-id');
    const existing = makeDbArticle({ authorId: 'editor-id' });
    prismaMock.article.findUnique.mockResolvedValueOnce(existing);
    const updated = { ...existing, title: 'Updated Title' };
    prismaMock.article.update.mockResolvedValueOnce(updated);
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: 1 } });
    prismaMock.articleRevision.create.mockResolvedValueOnce({} as never);

    const result = await updateArticle('my-article', { title: 'Updated Title' }, session);

    expect(result.title).toBe('Updated Title');
  });

  it('allows ADMIN to update any article regardless of author', async () => {
    const session = makeSession(Role.ADMIN, 'admin-id');
    const existing = makeDbArticle({ authorId: 'other-author' });
    prismaMock.article.findUnique.mockResolvedValueOnce(existing);
    prismaMock.article.update.mockResolvedValueOnce(existing);
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: 2 } });
    prismaMock.articleRevision.create.mockResolvedValueOnce({} as never);

    await expect(
      updateArticle('my-article', { title: 'Admin Update' }, session),
    ).resolves.not.toThrow();
  });

  it('creates a new revision snapshot on every update', async () => {
    const session = makeSession(Role.EDITOR, 'editor-id');
    const existing = makeDbArticle({ authorId: 'editor-id' });
    prismaMock.article.findUnique.mockResolvedValueOnce(existing);
    prismaMock.article.update.mockResolvedValueOnce(existing);
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: 3 } });
    prismaMock.articleRevision.create.mockResolvedValueOnce({} as never);

    await updateArticle('my-article', { title: 'New Title' }, session);

    expect(prismaMock.articleRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revisionNumber: 4 }),
      }),
    );
  });

  it('sets publishedAt when status changes to PUBLISHED', async () => {
    const session = makeSession(Role.EDITOR, 'editor-id');
    const existing = makeDbArticle({ authorId: 'editor-id', status: ArticleStatus.DRAFT, publishedAt: null });
    prismaMock.article.findUnique.mockResolvedValueOnce(existing);
    prismaMock.article.update.mockResolvedValueOnce({ ...existing, status: ArticleStatus.PUBLISHED });
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: 1 } });
    prismaMock.articleRevision.create.mockResolvedValueOnce({} as never);

    await updateArticle('my-article', { status: ArticleStatus.PUBLISHED }, session);

    expect(prismaMock.article.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ publishedAt: expect.any(Date) }),
      }),
    );
  });

  it('updates tag connections when tagIds are provided', async () => {
    const session = makeSession(Role.EDITOR, 'editor-id');
    const existing = makeDbArticle({ authorId: 'editor-id' });
    prismaMock.article.findUnique.mockResolvedValueOnce(existing);
    prismaMock.article.update.mockResolvedValueOnce(existing);
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: 1 } });
    prismaMock.articleRevision.create.mockResolvedValueOnce({} as never);

    await updateArticle('my-article', { tagIds: ['new-tag-1'] }, session);

    expect(prismaMock.article.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tags: expect.objectContaining({ deleteMany: {}, create: expect.any(Array) }),
        }),
      }),
    );
  });

  it('runs update and revision creation inside a transaction', async () => {
    const session = makeSession(Role.EDITOR, 'editor-id');
    const existing = makeDbArticle({ authorId: 'editor-id' });
    prismaMock.article.findUnique.mockResolvedValueOnce(existing);
    prismaMock.article.update.mockResolvedValueOnce(existing);
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: 1 } });
    prismaMock.articleRevision.create.mockResolvedValueOnce({} as never);

    await updateArticle('my-article', { title: 'New Title' }, session);

    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});

// ─── deleteArticle ────────────────────────────────────────────────────────────

describe('deleteArticle', () => {
  it('throws ForbiddenError when EDITOR tries to delete any article', async () => {
    const session = makeSession(Role.EDITOR, 'editor-id');

    await expect(deleteArticle('some-slug', session)).rejects.toThrow(ForbiddenError);
    expect(prismaMock.article.update).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when VIEWER tries to delete any article', async () => {
    const session = makeSession(Role.VIEWER);

    await expect(deleteArticle('some-slug', session)).rejects.toThrow(ForbiddenError);
  });

  it('throws NotFoundError when article does not exist', async () => {
    const session = makeSession(Role.ADMIN);
    prismaMock.article.findUnique.mockResolvedValueOnce(null);

    await expect(deleteArticle('ghost-slug', session)).rejects.toThrow(NotFoundError);
  });

  it('soft-deletes the article by setting deletedAt', async () => {
    const session = makeSession(Role.ADMIN);
    const existing = makeDbArticle();
    prismaMock.article.findUnique.mockResolvedValueOnce(existing);
    prismaMock.article.update.mockResolvedValueOnce({ ...existing, deletedAt: new Date() });

    await deleteArticle('my-article', session);

    expect(prismaMock.article.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: existing.id },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it('does not hard-delete the article record', async () => {
    const session = makeSession(Role.ADMIN);
    const existing = makeDbArticle();
    prismaMock.article.findUnique.mockResolvedValueOnce(existing);
    prismaMock.article.update.mockResolvedValueOnce(existing);

    await deleteArticle('my-article', session);

    expect(prismaMock.article.delete).not.toHaveBeenCalled();
  });
});

// ─── createFromImport ────────────────────────────────────────────────────────

describe('createFromImport', () => {
  beforeEach(() => {
    prismaMock.$transaction.mockImplementation((fn) => {
      if (typeof fn === 'function') return fn(prismaMock);
      return Promise.resolve(fn);
    });
  });

  it('throws ForbiddenError when called with a VIEWER session', async () => {
    const session = makeSession(Role.VIEWER);

    await expect(
      createFromImport({ title: 'Imported Doc', content: 'Content' }, session),
    ).rejects.toThrow(ForbiddenError);
  });

  it('creates the article with DRAFT status regardless of session role', async () => {
    const session = makeSession(Role.ADMIN, 'system-id');
    prismaMock.article.findUnique.mockResolvedValueOnce(null);
    prismaMock.article.create.mockResolvedValueOnce(
      makeDbArticle({ status: ArticleStatus.DRAFT }),
    );
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: null } });
    prismaMock.articleRevision.create.mockResolvedValueOnce({} as never);

    const result = await createFromImport({ title: 'Imported Doc', content: 'Body' }, session);

    expect(result.status).toBe(ArticleStatus.DRAFT);
    expect(prismaMock.article.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: ArticleStatus.DRAFT }),
      }),
    );
  });

  it('uses SYSTEM session for SYSTEM role', async () => {
    const systemSession: AppSession = {
      user: { id: 'system-user-id', email: 'system@internal', name: 'System', role: Role.SYSTEM },
      expires: new Date(Date.now() + 3_600_000).toISOString(),
    };
    prismaMock.article.findUnique.mockResolvedValueOnce(null);
    prismaMock.article.create.mockResolvedValueOnce(makeDbArticle({ authorId: 'system-user-id' }));
    prismaMock.articleRevision.aggregate.mockResolvedValueOnce({ _max: { revisionNumber: null } });
    prismaMock.articleRevision.create.mockResolvedValueOnce({} as never);

    await createFromImport({ title: 'Imported Doc', content: 'Body' }, systemSession);

    expect(prismaMock.article.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authorId: 'system-user-id' }),
      }),
    );
  });
});
