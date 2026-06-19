import { ArticleStatus, Role } from '@prisma/client';
import { createTestUser } from '../helpers/db';
import { createArticle, updateArticle } from '@/lib/services/articles';
import { listByArticle, findById } from '@/lib/services/revisions';
import { NotFoundError } from '@/lib/errors';
import type { AppSession } from '@/types';

function makeSession(userId: string, role: Role): AppSession {
  return {
    user: { id: userId, email: 'user@example.com', name: 'Test User', role },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

// ─── listByArticle ────────────────────────────────────────────────────────────

describe('listByArticle (integration)', () => {
  it('returns revisions in descending revision number order', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const session = makeSession(editor.id, Role.EDITOR);

    const article = await createArticle(
      { title: 'Multi-revision Article', content: 'v1', tagIds: [] },
      session,
    );
    await updateArticle(article.slug, { content: 'v2' }, session);
    await updateArticle(article.slug, { content: 'v3' }, session);

    const revisions = await listByArticle(article.id, session);

    expect(revisions).toHaveLength(3);
    expect(revisions[0]?.revisionNumber).toBe(3);
    expect(revisions[1]?.revisionNumber).toBe(2);
    expect(revisions[2]?.revisionNumber).toBe(1);
  });

  it('returns RevisionSummary shape (no content, no title)', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const session = makeSession(editor.id, Role.EDITOR);

    const article = await createArticle(
      { title: 'Summary Test', content: 'body', tagIds: [] },
      session,
    );

    const [revision] = await listByArticle(article.id, session);

    expect(revision).toBeDefined();
    expect(revision).toHaveProperty('id');
    expect(revision).toHaveProperty('revisionNumber');
    expect(revision).toHaveProperty('authorName');
    expect(revision).toHaveProperty('createdAt');
    expect(revision).not.toHaveProperty('content');
    expect(revision).not.toHaveProperty('title');
  });

  it('maps author name correctly', async () => {
    const editor = await createTestUser({ role: Role.EDITOR, name: 'Named Author' });
    const session = makeSession(editor.id, Role.EDITOR);

    const article = await createArticle(
      { title: 'Author Test', content: 'body', tagIds: [] },
      session,
    );

    const [revision] = await listByArticle(article.id, session);
    expect(revision?.authorName).toBe('Named Author');
  });

  it('throws NotFoundError for a non-existent article id', async () => {
    const viewer = await createTestUser({ role: Role.VIEWER });
    const session = makeSession(viewer.id, Role.VIEWER);
    const fakeId = '00000000-0000-0000-0000-000000000000';

    await expect(listByArticle(fakeId, session)).rejects.toThrow(NotFoundError);
  });

  it('stores the changeSummary from update calls', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const session = makeSession(editor.id, Role.EDITOR);

    const article = await createArticle(
      { title: 'Change Summary Test', content: 'v1', tagIds: [] },
      session,
    );
    await updateArticle(
      article.slug,
      { content: 'v2', changeSummary: 'Fixed typos' },
      session,
    );

    const revisions = await listByArticle(article.id, session);
    expect(revisions[0]?.changeSummary).toBe('Fixed typos');
  });
});

// ─── findById ─────────────────────────────────────────────────────────────────

describe('findById (integration)', () => {
  it('returns the full RevisionDetail including title and content', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const session = makeSession(editor.id, Role.EDITOR);

    const article = await createArticle(
      { title: 'Detail Test', content: 'Original content', tagIds: [] },
      session,
    );

    const revisions = await listByArticle(article.id, session);
    const detail = await findById(revisions[0]!.id, session);

    expect(detail.title).toBe('Detail Test');
    expect(detail.content).toBe('Original content');
    expect(detail.revisionNumber).toBe(1);
    expect(detail.authorName).toBe(editor.name);
  });

  it('returns the snapshot state at the time of the revision, not the current state', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const session = makeSession(editor.id, Role.EDITOR);

    const article = await createArticle(
      { title: 'Snapshot Test', content: 'Version 1', tagIds: [] },
      session,
    );
    await updateArticle(article.slug, { content: 'Version 2' }, session);

    const revisions = await listByArticle(article.id, session);
    const oldRevision = revisions.find((r) => r.revisionNumber === 1);
    const detail = await findById(oldRevision!.id, session);

    expect(detail.content).toBe('Version 1');
    expect(detail.revisionNumber).toBe(1);
  });

  it('throws NotFoundError for a non-existent revision id', async () => {
    const viewer = await createTestUser({ role: Role.VIEWER });
    const session = makeSession(viewer.id, Role.VIEWER);
    const fakeId = '00000000-0000-0000-0000-000000000001';

    await expect(findById(fakeId, session)).rejects.toThrow(NotFoundError);
  });

  it('returns correct data for a specific intermediate revision', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const session = makeSession(editor.id, Role.EDITOR);

    const article = await createArticle({ title: 'V1', content: 'First', tagIds: [] }, session);
    await updateArticle(article.slug, { title: 'V2', content: 'Second' }, session);
    await updateArticle(article.slug, { title: 'V3', content: 'Third' }, session);

    const revisions = await listByArticle(article.id, session);
    const rev2 = revisions.find((r) => r.revisionNumber === 2);
    const detail = await findById(rev2!.id, session);

    expect(detail.title).toBe('V2');
    expect(detail.content).toBe('Second');
  });

  it('creates a proper diff-ready snapshot for article status updates', async () => {
    const editor = await createTestUser({ role: Role.EDITOR });
    const session = makeSession(editor.id, Role.EDITOR);

    const article = await createArticle(
      { title: 'Status Change', content: 'Body', tagIds: [] },
      session,
    );
    await updateArticle(article.slug, { status: ArticleStatus.PUBLISHED }, session);

    const revisions = await listByArticle(article.id, session);
    const rev2 = revisions.find((r) => r.revisionNumber === 2);
    const detail = await findById(rev2!.id, session);

    expect(detail.title).toBe('Status Change');
    expect(detail.content).toBe('Body');
  });
});
