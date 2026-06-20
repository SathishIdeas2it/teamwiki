jest.mock('fs/promises');

import path from 'path';
import * as fsp from 'fs/promises';
import type { Dirent, Stats } from 'fs';
import { McpFilesystemClient } from '@/lib/mcp/client';

const mockReaddir = fsp.readdir as jest.Mock;
const mockStat = fsp.stat as jest.Mock;
const mockReadFile = fsp.readFile as jest.Mock;
const mockMkdir = fsp.mkdir as jest.Mock;
const mockRename = fsp.rename as jest.Mock;

const ROOT = path.resolve('/mcp-import-root');

function makeDirent(name: string, isFile: boolean): Dirent {
  return { name, isFile: () => isFile, isDirectory: () => !isFile } as unknown as Dirent;
}

function makeStat(size: number, mtime: Date): Stats {
  return { size, mtime } as unknown as Stats;
}

describe('McpFilesystemClient', () => {
  let client: McpFilesystemClient;

  beforeEach(() => {
    client = new McpFilesystemClient(ROOT);
  });

  describe('getRootDir', () => {
    it('returns the resolved root directory', () => {
      expect(client.getRootDir()).toBe(ROOT);
    });

    it('resolves relative paths to absolute', () => {
      const relative = new McpFilesystemClient('relative/path');
      expect(path.isAbsolute(relative.getRootDir())).toBe(true);
    });
  });

  describe('listFiles', () => {
    it('returns metadata for files with allowed extensions', async () => {
      const mtime = new Date('2024-01-15T10:00:00.000Z');
      mockReaddir.mockResolvedValue([
        makeDirent('guide.md', true),
        makeDirent('notes.txt', true),
        makeDirent('doc.markdown', true),
      ]);
      mockStat.mockResolvedValue(makeStat(1024, mtime));

      const files = await client.listFiles();

      expect(files).toHaveLength(3);
      expect(files[0]).toMatchObject({
        name: 'guide.md',
        path: path.join(ROOT, 'guide.md'),
        sizeBytes: 1024,
        mtime: mtime.toISOString(),
        extension: '.md',
      });
    });

    it('excludes files with unsupported extensions', async () => {
      mockReaddir.mockResolvedValue([
        makeDirent('image.png', true),
        makeDirent('data.json', true),
        makeDirent('doc.md', true),
      ]);
      mockStat.mockResolvedValue(makeStat(512, new Date()));

      const files = await client.listFiles();

      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('doc.md');
    });

    it('excludes non-file directory entries', async () => {
      mockReaddir.mockResolvedValue([
        makeDirent('subdir', false),
        makeDirent('guide.md', true),
      ]);
      mockStat.mockResolvedValue(makeStat(100, new Date()));

      const files = await client.listFiles();

      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('guide.md');
    });

    it('returns empty array when no matching files exist', async () => {
      mockReaddir.mockResolvedValue([makeDirent('image.png', true)]);

      const files = await client.listFiles();

      expect(files).toHaveLength(0);
    });

    it('reads stat for each matching file', async () => {
      const mtime = new Date('2024-06-01T00:00:00.000Z');
      mockReaddir.mockResolvedValue([makeDirent('article.md', true)]);
      mockStat.mockResolvedValue(makeStat(2048, mtime));

      await client.listFiles();

      expect(mockStat).toHaveBeenCalledWith(path.join(ROOT, 'article.md'));
    });
  });

  describe('readFile', () => {
    it('reads file content and returns metadata', async () => {
      const filePath = path.join(ROOT, 'article.md');
      const mtime = new Date('2024-03-01T08:00:00.000Z');
      mockStat.mockResolvedValue(makeStat(2048, mtime));
      mockReadFile.mockResolvedValue('# Title\n\nContent here.');

      const result = await client.readFile(filePath);

      expect(result.content).toBe('# Title\n\nContent here.');
      expect(result.metadata).toMatchObject({
        name: 'article.md',
        path: filePath,
        sizeBytes: 2048,
        mtime: mtime.toISOString(),
        extension: '.md',
      });
    });

    it('reads file in utf-8 encoding', async () => {
      const filePath = path.join(ROOT, 'article.md');
      mockStat.mockResolvedValue(makeStat(100, new Date()));
      mockReadFile.mockResolvedValue('content');

      await client.readFile(filePath);

      expect(mockReadFile).toHaveBeenCalledWith(filePath, 'utf-8');
    });

    it('throws on path traversal attempt', async () => {
      const traversalPath = path.resolve(ROOT, '..', 'etc', 'passwd');
      await expect(client.readFile(traversalPath)).rejects.toThrow('Path traversal detected');
    });

    it('throws on absolute path outside root', async () => {
      const outsidePath = path.resolve('/other/dir/file.md');
      await expect(client.readFile(outsidePath)).rejects.toThrow('Path traversal detected');
    });
  });

  describe('moveFile', () => {
    it('creates destination directory and moves the file', async () => {
      const src = path.join(ROOT, 'file.md');
      const dest = path.join(ROOT, 'failed', 'file.md');
      mockMkdir.mockResolvedValue(undefined);
      mockRename.mockResolvedValue(undefined);

      await client.moveFile(src, dest);

      expect(mockMkdir).toHaveBeenCalledWith(path.join(ROOT, 'failed'), { recursive: true });
      expect(mockRename).toHaveBeenCalledWith(src, dest);
    });

    it('throws on path traversal in source path', async () => {
      const traversalSrc = path.resolve(ROOT, '..', 'secret.md');
      const dest = path.join(ROOT, 'failed', 'secret.md');
      await expect(client.moveFile(traversalSrc, dest)).rejects.toThrow('Path traversal detected');
    });

    it('throws on path traversal in destination path', async () => {
      const src = path.join(ROOT, 'file.md');
      const traversalDest = path.resolve(ROOT, '..', 'stolen.md');
      await expect(client.moveFile(src, traversalDest)).rejects.toThrow('Path traversal detected');
    });
  });
});

describe('getMcpClient', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('throws when IMPORT_DIR is not set', async () => {
    const saved = process.env['IMPORT_DIR'];
    delete process.env['IMPORT_DIR'];
    try {
      const { getMcpClient } = await import('@/lib/mcp/client');
      expect(() => getMcpClient()).toThrow('IMPORT_DIR environment variable is not set');
    } finally {
      if (saved !== undefined) process.env['IMPORT_DIR'] = saved;
    }
  });

  it('creates a client using IMPORT_DIR', async () => {
    process.env['IMPORT_DIR'] = '/test/imports';
    const { getMcpClient } = await import('@/lib/mcp/client');
    const client = getMcpClient();
    expect(client.getRootDir()).toBe(path.resolve('/test/imports'));
  });

  it('returns the same instance on repeated calls (singleton)', async () => {
    process.env['IMPORT_DIR'] = '/test/imports';
    const { getMcpClient } = await import('@/lib/mcp/client');
    expect(getMcpClient()).toBe(getMcpClient());
  });
});
