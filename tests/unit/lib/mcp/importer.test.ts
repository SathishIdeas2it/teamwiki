jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/lib/mcp/client');
jest.mock('@/lib/services/articles');
jest.mock('@/lib/services/audit');
jest.mock('@/lib/utils/slugify', () => ({
  slugify: jest.fn((name: string) =>
    name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, ''),
  ),
}));

import { AuditEventType } from '@prisma/client';
import path from 'path';
import { getMcpClient } from '@/lib/mcp/client';
import { createFromImport } from '@/lib/services/articles';
import { logEvent } from '@/lib/services/audit';
import { prismaMock } from '../../setup';
import { runImportPipeline, startImportPoller } from '@/lib/mcp/importer';
import type { McpFileMetadata, ArticleWithDetails } from '@/types';

const mockGetMcpClient = getMcpClient as jest.MockedFunction<typeof getMcpClient>;
const mockCreateFromImport = createFromImport as jest.MockedFunction<typeof createFromImport>;
const mockLogEvent = logEvent as jest.MockedFunction<typeof logEvent>;

function makeMockClient() {
  return {
    readFile: jest.fn(),
    listFiles: jest.fn(),
    moveFile: jest.fn(),
    getRootDir: jest.fn().mockReturnValue('/import'),
  };
}

function makeMetadata(overrides: Partial<McpFileMetadata> = {}): McpFileMetadata {
  return {
    name: 'my-article.md',
    path: '/import/my-article.md',
    sizeBytes: 1024,
    mtime: '2024-01-15T10:00:00.000Z',
    extension: '.md',
    ...overrides,
  };
}

function makeArticle(overrides: Partial<ArticleWithDetails> = {}): ArticleWithDetails {
  return {
    id: 'article-uuid',
    slug: 'my-article',
    title: 'my article',
    content: '# Content',
    status: 'DRAFT',
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: { id: 'system', name: 'System' },
    tags: [],
    revisionCount: 1,
    ...overrides,
  };
}

describe('runImportPipeline', () => {
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    mockClient = makeMockClient();
    mockGetMcpClient.mockReturnValue(mockClient as unknown as ReturnType<typeof getMcpClient>);
    mockLogEvent.mockResolvedValue(undefined);
    prismaMock.auditLog.findFirst.mockResolvedValue(null);
  });

  describe('file read failures', () => {
    it('returns "failed" when readFile throws', async () => {
      mockClient.readFile.mockRejectedValue(new Error('permission denied'));

      const result = await runImportPipeline('/import/missing.md');

      expect(result).toBe('failed');
    });
  });

  describe('validation failures', () => {
    it('returns "failed" and moves file for unsupported extension', async () => {
      const metadata = makeMetadata({ name: 'data.json', extension: '.json' });
      mockClient.readFile.mockResolvedValue({ content: '{}', metadata });
      mockClient.moveFile.mockResolvedValue(undefined);

      const result = await runImportPipeline('/import/data.json');

      expect(result).toBe('failed');
      expect(mockClient.moveFile).toHaveBeenCalledWith(
        '/import/data.json',
        path.join(path.dirname('/import/data.json'), 'failed', 'data.json'),
      );
    });

    it('returns "failed" and moves file when size exceeds 10 MB', async () => {
      const metadata = makeMetadata({ sizeBytes: 11 * 1024 * 1024 });
      mockClient.readFile.mockResolvedValue({ content: '# Big file', metadata });
      mockClient.moveFile.mockResolvedValue(undefined);

      const result = await runImportPipeline('/import/my-article.md');

      expect(result).toBe('failed');
      expect(mockClient.moveFile).toHaveBeenCalled();
    });
  });

  describe('fingerprint / deduplication', () => {
    it('returns "skipped" when file already imported with matching fingerprint', async () => {
      const metadata = makeMetadata();
      mockClient.readFile.mockResolvedValue({ content: '# Content', metadata });
      prismaMock.auditLog.findFirst.mockResolvedValue({
        id: 'log-1',
        eventType: AuditEventType.MCP_IMPORT_SUCCESS,
        actorId: 'system',
        targetId: 'article-uuid',
        targetType: 'article',
        metadata: {
          fileName: 'my-article.md',
          sizeBytes: 1024,
          mtime: '2024-01-15T10:00:00.000Z',
        },
        createdAt: new Date(),
      });

      const result = await runImportPipeline('/import/my-article.md');

      expect(result).toBe('skipped');
      expect(mockCreateFromImport).not.toHaveBeenCalled();
    });

    it('imports when filename matches but sizeBytes differs (file changed)', async () => {
      const metadata = makeMetadata({ sizeBytes: 2048 });
      mockClient.readFile.mockResolvedValue({ content: '# Updated content', metadata });
      prismaMock.auditLog.findFirst.mockResolvedValue({
        id: 'log-1',
        eventType: AuditEventType.MCP_IMPORT_SUCCESS,
        actorId: 'system',
        targetId: 'article-uuid',
        targetType: 'article',
        metadata: { fileName: 'my-article.md', sizeBytes: 1024, mtime: '2024-01-15T10:00:00.000Z' },
        createdAt: new Date(),
      });
      mockCreateFromImport.mockResolvedValue(makeArticle());

      const result = await runImportPipeline('/import/my-article.md');

      expect(result).toBe('imported');
    });
  });

  describe('successful import', () => {
    it('returns "imported" for a valid file with no tags', async () => {
      const metadata = makeMetadata();
      mockClient.readFile.mockResolvedValue({ content: '# My Article\n\nHello world.', metadata });
      mockCreateFromImport.mockResolvedValue(makeArticle());

      const result = await runImportPipeline('/import/my-article.md');

      expect(result).toBe('imported');
      expect(mockCreateFromImport).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'my article', tagIds: [] }),
        expect.objectContaining({ user: expect.objectContaining({ role: 'SYSTEM' }) }),
      );
    });

    it('logs a success audit event with fingerprint metadata', async () => {
      const metadata = makeMetadata();
      mockClient.readFile.mockResolvedValue({ content: '# Content', metadata });
      mockCreateFromImport.mockResolvedValue(makeArticle({ id: 'article-uuid' }));

      await runImportPipeline('/import/my-article.md');

      expect(mockLogEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.MCP_IMPORT_SUCCESS,
          metadata: expect.objectContaining({
            fileName: 'my-article.md',
            sizeBytes: 1024,
            mtime: '2024-01-15T10:00:00.000Z',
            articleId: 'article-uuid',
          }),
        }),
      );
    });

    it('derives title by stripping extension and replacing hyphens with spaces', async () => {
      const metadata = makeMetadata({ name: 'getting-started-with-nextjs.md' });
      mockClient.readFile.mockResolvedValue({ content: '# Getting Started', metadata });
      mockCreateFromImport.mockResolvedValue(makeArticle());

      await runImportPipeline('/import/getting-started-with-nextjs.md');

      expect(mockCreateFromImport).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'getting started with nextjs' }),
        expect.anything(),
      );
    });

    it('uses body content after stripping frontmatter', async () => {
      const content = '---\ntags: []\n---\n\n# Article Body\n\nReal content.';
      const metadata = makeMetadata();
      mockClient.readFile.mockResolvedValue({ content, metadata });
      mockCreateFromImport.mockResolvedValue(makeArticle());

      await runImportPipeline('/import/my-article.md');

      expect(mockCreateFromImport).toHaveBeenCalledWith(
        expect.objectContaining({ content: '# Article Body\n\nReal content.' }),
        expect.anything(),
      );
    });
  });

  describe('tag extraction', () => {
    it('creates new tags from inline frontmatter tags: [tag1, tag2]', async () => {
      const content = '---\ntags: [javascript, typescript, react]\n---\n\n# Article\n\nContent.';
      const metadata = makeMetadata();
      mockClient.readFile.mockResolvedValue({ content, metadata });
      prismaMock.tag.findUnique.mockResolvedValue(null);
      prismaMock.tag.create
        .mockResolvedValueOnce({ id: 'tag-js' } as never)
        .mockResolvedValueOnce({ id: 'tag-ts' } as never)
        .mockResolvedValueOnce({ id: 'tag-react' } as never);
      mockCreateFromImport.mockResolvedValue(makeArticle());

      const result = await runImportPipeline('/import/my-article.md');

      expect(result).toBe('imported');
      expect(prismaMock.tag.create).toHaveBeenCalledTimes(3);
      expect(mockCreateFromImport).toHaveBeenCalledWith(
        expect.objectContaining({ tagIds: ['tag-js', 'tag-ts', 'tag-react'] }),
        expect.anything(),
      );
    });

    it('reuses existing tags instead of creating duplicates', async () => {
      const content = '---\ntags: [javascript]\n---\n\nContent.';
      const metadata = makeMetadata();
      mockClient.readFile.mockResolvedValue({ content, metadata });
      prismaMock.tag.findUnique.mockResolvedValue({ id: 'existing-js-id' } as never);
      mockCreateFromImport.mockResolvedValue(makeArticle());

      const result = await runImportPipeline('/import/my-article.md');

      expect(result).toBe('imported');
      expect(prismaMock.tag.create).not.toHaveBeenCalled();
      expect(mockCreateFromImport).toHaveBeenCalledWith(
        expect.objectContaining({ tagIds: ['existing-js-id'] }),
        expect.anything(),
      );
    });

    it('extracts block-style frontmatter tags', async () => {
      const content = '---\ntags:\n  - devops\n  - kubernetes\n---\n\nContent.';
      const metadata = makeMetadata();
      mockClient.readFile.mockResolvedValue({ content, metadata });
      prismaMock.tag.findUnique.mockResolvedValue(null);
      prismaMock.tag.create
        .mockResolvedValueOnce({ id: 'tag-devops' } as never)
        .mockResolvedValueOnce({ id: 'tag-k8s' } as never);
      mockCreateFromImport.mockResolvedValue(makeArticle());

      const result = await runImportPipeline('/import/my-article.md');

      expect(result).toBe('imported');
      expect(prismaMock.tag.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('import failure', () => {
    it('returns "failed" and moves file when createFromImport throws', async () => {
      const metadata = makeMetadata();
      mockClient.readFile.mockResolvedValue({ content: '# Content', metadata });
      mockCreateFromImport.mockRejectedValue(new Error('DB constraint violation'));
      mockClient.moveFile.mockResolvedValue(undefined);

      const result = await runImportPipeline('/import/my-article.md');

      expect(result).toBe('failed');
      expect(mockClient.moveFile).toHaveBeenCalledWith(
        '/import/my-article.md',
        path.join('/import', 'failed', 'my-article.md'),
      );
    });

    it('continues without throwing when moveFile itself fails', async () => {
      const metadata = makeMetadata();
      mockClient.readFile.mockResolvedValue({ content: '# Content', metadata });
      mockCreateFromImport.mockRejectedValue(new Error('DB error'));
      mockClient.moveFile.mockRejectedValue(new Error('disk full'));

      await expect(runImportPipeline('/import/my-article.md')).resolves.toBe('failed');
    });
  });
});

describe('startImportPoller', () => {
  let mockClient: ReturnType<typeof makeMockClient>;

  beforeEach(() => {
    jest.useFakeTimers();
    mockClient = makeMockClient();
    mockGetMcpClient.mockReturnValue(mockClient as unknown as ReturnType<typeof getMcpClient>);
    mockClient.listFiles.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env['IMPORT_POLL_INTERVAL_MS'];
  });

  it('calls listFiles after the configured interval elapses', async () => {
    process.env['IMPORT_POLL_INTERVAL_MS'] = '5000';
    startImportPoller();

    expect(mockClient.listFiles).not.toHaveBeenCalled();

    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockClient.listFiles).toHaveBeenCalledTimes(1);
  });

  it('uses the default 60000ms interval when env var is absent', async () => {
    startImportPoller();

    jest.advanceTimersByTime(59999);
    await Promise.resolve();
    expect(mockClient.listFiles).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(mockClient.listFiles).toHaveBeenCalledTimes(1);
  });

  it('fires multiple times across multiple intervals', async () => {
    process.env['IMPORT_POLL_INTERVAL_MS'] = '5000';
    startImportPoller();

    jest.advanceTimersByTime(15000);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockClient.listFiles).toHaveBeenCalledTimes(3);
  });

  it('logs error and continues when a polling cycle throws', async () => {
    process.env['IMPORT_POLL_INTERVAL_MS'] = '5000';
    mockClient.listFiles.mockRejectedValue(new Error('directory not found'));
    startImportPoller();

    jest.advanceTimersByTime(5000);
    await Promise.resolve();
    await Promise.resolve();

    // Should not throw; poller swallows the error
    expect(mockClient.listFiles).toHaveBeenCalledTimes(1);
  });
});
