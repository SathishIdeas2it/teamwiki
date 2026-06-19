import { prismaMock } from '../../setup';
import { ArticleStatus, Role } from '@prisma/client';
import { listTags, createTag, updateTag, deleteTag, listArticlesByTag } from '@/lib/services/tags';
import { ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import type { AppSession } from '@/types';

jest.mock('@/lib/utils/slugify', () => ({
  slugify: jest.fn((text: string) =>
    text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
  ),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(role: Role, id = 'session-user-id'): AppSession {
  return {
    user: { id, email: 'user@example.com', name: 'User', role },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

function makeDbTag(overrides: Partial<{
  id: string;
  name: string;
  slug: string;
  category: { id: string; name: string; slug: string } | null;
  _count: { articles: number };
}> = {}) {
  return {
    id: 'tag-uuid-1',
    name: 'TypeScript',
    slug: 'typescript',
    category: null,
    _count: { articles: 0 },
    ...overrides,
  };
}

// ─── listTags ────────────────────────────────────────────────────────────────

describe('listTags', () => {
  it('returns all tags with their category and article count', async () => {
    const session = makeSession(Role.VIEWER);
    prismaMock.tag.findMany.mockResolvedValueOnce([
      makeDbTag({ name: 'React', slug: 'react', _count: { articles: 5 } }),
      makeDbTag({ id: 'tag-2', name: 'TypeScript', slug: 'typescript', _count: { articles: 10 } }),
    ]);

    const result = await listTags(session);

    expect(result).toHaveLength(2);
    expect(result[0]?.articleCount).toBe(5);
  });

  it('includes category info when tag belongs to a category', async () => {
    const session = makeSession(Role.VIEWER);
    const category = { id: 'cat-1', name: 'Frontend', slug: 'frontend' };
    prismaMock.tag.findMany.mockResolvedValueOnce([makeDbTag({ category })]);

    const result = await listTags(session);

    expect(result[0]?.category).toEqual(category);
  });

  it('returns empty array when no tags exist', async () => {
    const session = makeSession(Role.VIEWER);
    prismaMock.tag.findMany.mockResolvedValueOnce([]);

    const result = await listTags(session);

    expect(result).toHaveLength(0);
  });
});

// ─── createTag ────────────────────────────────────────────────────────────────

describe('createTag', () => {
  it('throws ForbiddenError when called by VIEWER', async () => {
    const session = makeSession(Role.VIEWER);
    await expect(createTag({ name: 'New Tag' }, session)).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when called by EDITOR', async () => {
    const session = makeSession(Role.EDITOR);
    await expect(createTag({ name: 'New Tag' }, session)).rejects.toThrow(ForbiddenError);
  });

  it('creates a tag with a generated slug for ADMIN', async () => {
    const session = makeSession(Role.ADMIN);
    prismaMock.tag.create.mockResolvedValueOnce(makeDbTag({ name: 'New Tag', slug: 'new-tag' }));

    const result = await createTag({ name: 'New Tag' }, session);

    expect(result.slug).toBe('new-tag');
    expect(prismaMock.tag.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'New Tag', slug: 'new-tag' }),
      }),
    );
  });

  it('links to a category when categoryId is provided', async () => {
    const session = makeSession(Role.ADMIN);
    prismaMock.tag.create.mockResolvedValueOnce(
      makeDbTag({ category: { id: 'cat-1', name: 'Frontend', slug: 'frontend' } }),
    );

    await createTag({ name: 'Tag', categoryId: 'cat-1' }, session);

    expect(prismaMock.tag.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ categoryId: 'cat-1' }),
      }),
    );
  });

  it('throws ConflictError when a tag with the same slug already exists', async () => {
    const session = makeSession(Role.ADMIN);
    prismaMock.tag.create.mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    );

    await expect(createTag({ name: 'Existing Tag' }, session)).rejects.toThrow(ConflictError);
  });
});

// ─── updateTag ────────────────────────────────────────────────────────────────

describe('updateTag', () => {
  it('throws ForbiddenError when called by EDITOR', async () => {
    const session = makeSession(Role.EDITOR);
    await expect(updateTag('some-tag', { name: 'Updated' }, session)).rejects.toThrow(ForbiddenError);
  });

  it('throws NotFoundError when tag does not exist', async () => {
    const session = makeSession(Role.ADMIN);
    prismaMock.tag.findUnique.mockResolvedValueOnce(null);

    await expect(updateTag('ghost-tag', { name: 'Updated' }, session)).rejects.toThrow(NotFoundError);
  });

  it('updates the tag name for ADMIN', async () => {
    const session = makeSession(Role.ADMIN);
    const existing = makeDbTag({ slug: 'old-name', name: 'Old Name' });
    prismaMock.tag.findUnique.mockResolvedValueOnce(existing);
    prismaMock.tag.update.mockResolvedValueOnce({ ...existing, name: 'New Name' });

    const result = await updateTag('old-name', { name: 'New Name' }, session);

    expect(result.name).toBe('New Name');
  });

  it('can clear the category by setting categoryId to null', async () => {
    const session = makeSession(Role.ADMIN);
    const existing = makeDbTag({ category: { id: 'cat-1', name: 'Frontend', slug: 'frontend' } });
    prismaMock.tag.findUnique.mockResolvedValueOnce(existing);
    prismaMock.tag.update.mockResolvedValueOnce({ ...existing, category: null });

    const result = await updateTag('typescript', { categoryId: null }, session);

    expect(result.category).toBeNull();
    expect(prismaMock.tag.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ category: { disconnect: true } }),
      }),
    );
  });
});

// ─── deleteTag ────────────────────────────────────────────────────────────────

describe('deleteTag', () => {
  it('throws ForbiddenError when called by VIEWER', async () => {
    const session = makeSession(Role.VIEWER);
    await expect(deleteTag('some-tag', session)).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when called by EDITOR', async () => {
    const session = makeSession(Role.EDITOR);
    await expect(deleteTag('some-tag', session)).rejects.toThrow(ForbiddenError);
  });

  it('throws NotFoundError when tag does not exist', async () => {
    const session = makeSession(Role.ADMIN);
    prismaMock.tag.findUnique.mockResolvedValueOnce(null);

    await expect(deleteTag('ghost-tag', session)).rejects.toThrow(NotFoundError);
  });

  it('deletes the tag for ADMIN', async () => {
    const session = makeSession(Role.ADMIN);
    const existing = makeDbTag();
    prismaMock.tag.findUnique.mockResolvedValueOnce(existing);
    prismaMock.tag.delete.mockResolvedValueOnce(existing);

    await deleteTag('typescript', session);

    expect(prismaMock.tag.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: existing.id } }),
    );
  });
});

// ─── listArticlesByTag ────────────────────────────────────────────────────────

describe('listArticlesByTag', () => {
  it('throws NotFoundError when tag does not exist', async () => {
    const session = makeSession(Role.VIEWER);
    prismaMock.tag.findUnique.mockResolvedValueOnce(null);

    await expect(listArticlesByTag('ghost-tag', 1, 20, session)).rejects.toThrow(NotFoundError);
  });

  it('returns paginated published articles for the tag', async () => {
    const session = makeSession(Role.VIEWER);
    const tag = makeDbTag();
    prismaMock.tag.findUnique.mockResolvedValueOnce(tag);
    prismaMock.$transaction.mockResolvedValueOnce([
      2,
      [
        {
          id: 'a1', slug: 'art-1', title: 'Art 1',
          status: ArticleStatus.PUBLISHED, publishedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
          authorId: 'u1', author: { id: 'u1', name: 'Author' }, tags: [],
        },
        {
          id: 'a2', slug: 'art-2', title: 'Art 2',
          status: ArticleStatus.PUBLISHED, publishedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
          authorId: 'u1', author: { id: 'u1', name: 'Author' }, tags: [],
        },
      ],
    ]);

    const result = await listArticlesByTag('typescript', 1, 20, session);

    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(2);
  });

  it('calculates pagination meta correctly', async () => {
    const session = makeSession(Role.VIEWER);
    prismaMock.tag.findUnique.mockResolvedValueOnce(makeDbTag());
    prismaMock.$transaction.mockResolvedValueOnce([35, []]);

    const result = await listArticlesByTag('typescript', 1, 10, session);

    expect(result.meta.totalPages).toBe(4);
    expect(result.meta.limit).toBe(10);
  });
});
