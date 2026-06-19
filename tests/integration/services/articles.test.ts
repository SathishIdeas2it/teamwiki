import { ArticleStatus, Role } from '@prisma/client';
import { createTestUser } from '../helpers/db';
import {
  listArticles,
  getArticleBySlug,
  createArticle,
  updateArticle,
  deleteArticle,
  createFromImport,
} from '@/lib/services/articles';
import { listByArticle } from '@/lib/services/revisions';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import type { AppSession } from '@/types';

function makeSession(userId: string, role: Role): AppSession {
  return {
    user: { id: userId, email: 'user@example.com', name: 'Test User', role },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

// ─── createArticle ───────────────────────────────────────────────────────────

describe('createArticle (integration)', () => {
  it('creates an article with correct fields and revision #1', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const session = makeSession(editor.id, Role.EDITOR);

    const article = await createArticle(
      { title: 'My First Article', content: 'Hello world', tagIds: [], status: ArticleStatus.DRAFT },
      session,
    );

    expect(article.slug).toBe('my-first-article');
    expect(article.title).toBe('My First Article');
    expect(article.status).toBe(ArticleStatus.DRAFT);
    expect(article.revisionCount).toBe(1);
    expect(article.author.id).toBe(editor.id);
  });

  it('generates a unique slug when the base slug is already taken', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const session = makeSession(editor.id, Role.EDITOR);

    await createArticle({ title: 'Duplicate Title', content: 'First', tagIds: [] }, session);
    const second = await createArticle({ title: 'Duplicate Title', content: 'Second', tagIds: [] }, session);

    expect(second.slug).toBe('duplicate-title-2');
  });

  it('creates revision #1 automatically and it can be listed', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const session = makeSession(editor.id, Role.EDITOR);

    const article = await createArticle(
      { title: 'Revision Test', content: 'Initial content', tagIds: [] },
      session,
    );
    const revisions = await listByArticle(article.id, session);

    expect(revisions).toHaveLength(1);
    expect(revisions[0]?.revisionNumber).toBe(1);
  });

  it('throws ForbiddenError when called by VIEWER', async () => {
    const viewer = await createTestUser({ role: Role.VIEWER });
    const session = makeSession(viewer.id, Role.VIEWER);

    await expect(
      createArticle({ title: 'Title', content: 'Body', tagIds: [] }, session),
    ).rejects.toThrow(ForbiddenError);
  });

  it('sets publishedAt when status is PUBLISHED', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const session = makeSession(editor.id, Role.EDITOR);

    const article = await createArticle(
      { title: 'Published Article', content: 'Body', tagIds: [], status: ArticleStatus.PUBLISHED },
      session,
    );

    expect(article.publishedAt).not.toBeNull();
  });
});

// ─── getArticleBySlug ─────────────────────────────────────────────────────────

describe('getArticleBySlug (integration)', () => {
  it('returns a published article to a VIEWER', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const viewer = await createTestUser({ role: Role.VIEWER });
    const editorSession = makeSession(editor.id, Role.EDITOR);
    const viewerSession = makeSession(viewer.id, Role.VIEWER);

    const created = await createArticle(
      { title: 'Viewable Article', content: 'Body', tagIds: [], status: ArticleStatus.PUBLISHED },
      editorSession,
    );

    const result = await getArticleBySlug(created.slug, viewerSession);
    expect(result.id).toBe(created.id);
  });

  it('throws ForbiddenError when VIEWER requests a draft', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const viewer = await createTestUser({ role: Role.VIEWER });
    const editorSession = makeSession(editor.id, Role.EDITOR);
    const viewerSession = makeSession(viewer.id, Role.VIEWER);

    const draft = await createArticle(
      { title: 'Draft Article', content: 'Body', tagIds: [] },
      editorSession,
    );

    await expect(getArticleBySlug(draft.slug, viewerSession)).rejects.toThrow(ForbiddenError);
  });

  it('returns a draft to its author', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const session = makeSession(editor.id, Role.EDITOR);

    const draft = await createArticle(
      { title: 'My Draft', content: 'Body', tagIds: [] },
      session,
    );

    const result = await getArticleBySlug(draft.slug, session);
    expect(result.id).toBe(draft.id);
  });

  it('throws NotFoundError for a non-existent slug', async () => {
    const viewer = await createTestUser({ role: Role.VIEWER });
    const session = makeSession(viewer.id, Role.VIEWER);

    await expect(getArticleBySlug('ghost-slug', session)).rejects.toThrow(NotFoundError);
  });
});

// ─── listArticles ─────────────────────────────────────────────────────────────

describe('listArticles (integration)', () => {
  it('VIEWER sees only published articles', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const viewer = await createTestUser({ role: Role.VIEWER });
    const editorSession = makeSession(editor.id, Role.EDITOR);
    const viewerSession = makeSession(viewer.id, Role.VIEWER);

    await createArticle({ title: 'Draft One', content: 'x', tagIds: [] }, editorSession);
    await createArticle(
      { title: 'Published One', content: 'y', tagIds: [], status: ArticleStatus.PUBLISHED },
      editorSession,
    );

    const result = await listArticles({ page: 1, limit: 50 }, viewerSession);
    expect(result.data.every((a) => a.status === ArticleStatus.PUBLISHED)).toBe(true);
    expect(result.data.some((a) => a.title === 'Published One')).toBe(true);
    expect(result.data.some((a) => a.title === 'Draft One')).toBe(false);
  });

  it('EDITOR sees own drafts + published articles from anyone', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const otherEditor = await createTestUser({ role: Role.EDITOR });
    const editorSession = makeSession(editor.id, Role.EDITOR);
    const otherEditorSession = makeSession(otherEditor.id, Role.EDITOR);

    await createArticle({ title: 'My Draft', content: 'x', tagIds: [] }, editorSession);
    await createArticle({ title: "Other's Draft", content: 'x', tagIds: [] }, otherEditorSession);

    const result = await listArticles({ page: 1, limit: 50 }, editorSession);
    expect(result.data.some((a) => a.title === 'My Draft')).toBe(true);
    expect(result.data.some((a) => a.title === "Other's Draft")).toBe(false);
  });

  it('ADMIN sees all articles including drafts', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const admin = await createTestUser({ role: Role.ADMIN });
    const editorSession = makeSession(editor.id, Role.EDITOR);
    const adminSession = makeSession(admin.id, Role.ADMIN);

    await createArticle({ title: 'Hidden Draft', content: 'x', tagIds: [] }, editorSession);

    const result = await listArticles({ page: 1, limit: 50 }, adminSession);
    expect(result.data.some((a) => a.title === 'Hidden Draft')).toBe(true);
  });

  it('paginates correctly', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const admin = await createTestUser({ role: Role.ADMIN });
    const editorSession = makeSession(editor.id, Role.EDITOR);
    const adminSession = makeSession(admin.id, Role.ADMIN);

    for (let i = 0; i < 5; i++) {
      await createArticle({ title: `Article ${i}`, content: 'x', tagIds: [] }, editorSession);
    }

    const page1 = await listArticles({ page: 1, limit: 3 }, adminSession);
    const page2 = await listArticles({ page: 2, limit: 3 }, adminSession);

    expect(page1.data).toHaveLength(3);
    expect(page1.meta.totalPages).toBeGreaterThanOrEqual(2);
    expect(page2.data.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── updateArticle ────────────────────────────────────────────────────────────

describe('updateArticle (integration)', () => {
  it('EDITOR can update their own article and creates a new revision', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const session = makeSession(editor.id, Role.EDITOR);

    const article = await createArticle(
      { title: 'Original Title', content: 'Original content', tagIds: [] },
      session,
    );

    const updated = await updateArticle(article.slug, { title: 'Updated Title' }, session);

    expect(updated.title).toBe('Updated Title');
    expect(updated.revisionCount).toBe(2);
  });

  it('throws ForbiddenError when EDITOR tries to update another author article', async () => {
    const author = await createTestUser({ role: Role.EDITOR });
    const other = await createTestUser({ role: Role.EDITOR });
    const authorSession = makeSession(author.id, Role.EDITOR);
    const otherSession = makeSession(other.id, Role.EDITOR);

    const article = await createArticle(
      { title: 'Author Article', content: 'Body', tagIds: [] },
      authorSession,
    );

    await expect(
      updateArticle(article.slug, { title: 'Hijacked' }, otherSession),
    ).rejects.toThrow(ForbiddenError);
  });

  it('ADMIN can update any article', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const admin = await createTestUser({ role: Role.ADMIN });
    const editorSession = makeSession(editor.id, Role.EDITOR);
    const adminSession = makeSession(admin.id, Role.ADMIN);

    const article = await createArticle(
      { title: 'Editor Article', content: 'Body', tagIds: [] },
      editorSession,
    );

    const updated = await updateArticle(article.slug, { title: 'Admin Updated' }, adminSession);
    expect(updated.title).toBe('Admin Updated');
  });

  it('sets publishedAt when status changes to PUBLISHED', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const session = makeSession(editor.id, Role.EDITOR);

    const article = await createArticle(
      { title: 'Draft to Publish', content: 'Body', tagIds: [] },
      session,
    );
    expect(article.publishedAt).toBeNull();

    const updated = await updateArticle(article.slug, { status: ArticleStatus.PUBLISHED }, session);
    expect(updated.publishedAt).not.toBeNull();
  });

  it('throws NotFoundError for a non-existent slug', async () => {
    const admin = await createTestUser({ role: Role.ADMIN });
    const session = makeSession(admin.id, Role.ADMIN);

    await expect(
      updateArticle('ghost-slug', { title: 'Ghost' }, session),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── deleteArticle ────────────────────────────────────────────────────────────

describe('deleteArticle (integration)', () => {
  it('ADMIN soft-deletes an article (article is no longer retrievable by slug)', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const admin = await createTestUser({ role: Role.ADMIN });
    const editorSession = makeSession(editor.id, Role.EDITOR);
    const adminSession = makeSession(admin.id, Role.ADMIN);

    const article = await createArticle(
      { title: 'Article To Delete', content: 'Body', tagIds: [], status: ArticleStatus.PUBLISHED },
      editorSession,
    );

    await deleteArticle(article.slug, adminSession);

    await expect(getArticleBySlug(article.slug, adminSession)).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when EDITOR tries to delete', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const session = makeSession(editor.id, Role.EDITOR);

    const article = await createArticle(
      { title: 'Protected Article', content: 'Body', tagIds: [] },
      session,
    );

    await expect(deleteArticle(article.slug, session)).rejects.toThrow(ForbiddenError);
  });

  it('throws NotFoundError for an already-deleted article', async () => {
    const admin = await createTestUser({ role: Role.ADMIN });
    const session = makeSession(admin.id, Role.ADMIN);

    const article = await createArticle(
      { title: 'Delete Twice', content: 'Body', tagIds: [] },
      session,
    );

    await deleteArticle(article.slug, session);
    await expect(deleteArticle(article.slug, session)).rejects.toThrow(NotFoundError);
  });
});

// ─── createFromImport ────────────────────────────────────────────────────────

describe('createFromImport (integration)', () => {
  it('creates a DRAFT article attributed to the session user', async () => {
    const admin = await createTestUser({ role: Role.ADMIN });
    const session = makeSession(admin.id, Role.ADMIN);

    const article = await createFromImport(
      { title: 'Imported Document', content: 'Content here' },
      session,
    );

    expect(article.status).toBe(ArticleStatus.DRAFT);
    expect(article.author.id).toBe(admin.id);
    expect(article.revisionCount).toBe(1);
  });

  it('throws ForbiddenError when called with a VIEWER session', async () => {
    const viewer = await createTestUser({ role: Role.VIEWER });
    const session = makeSession(viewer.id, Role.VIEWER);

    await expect(
      createFromImport({ title: 'Imported', content: 'Body' }, session),
    ).rejects.toThrow(ForbiddenError);
  });
});
