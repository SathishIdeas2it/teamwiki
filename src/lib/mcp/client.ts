import path from 'path';
import * as fsp from 'fs/promises';
import type { McpFileMetadata } from '@/types';

const ALLOWED_EXTENSIONS = new Set(['.md', '.txt', '.markdown']);

export class McpFilesystemClient {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  private assertWithinRoot(filePath: string): void {
    const resolved = path.resolve(filePath);
    const rootWithSep = this.rootDir.endsWith(path.sep)
      ? this.rootDir
      : this.rootDir + path.sep;
    if (!resolved.startsWith(rootWithSep)) {
      throw new Error('Path traversal detected');
    }
  }

  async listFiles(): Promise<McpFileMetadata[]> {
    const entries = await fsp.readdir(this.rootDir, { withFileTypes: true });
    const results: McpFileMetadata[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;

      const filePath = path.join(this.rootDir, entry.name);
      const stat = await fsp.stat(filePath);

      results.push({
        name: entry.name,
        path: filePath,
        sizeBytes: stat.size,
        mtime: stat.mtime.toISOString(),
        extension: ext,
      });
    }

    return results;
  }

  async readFile(filePath: string): Promise<{ content: string; metadata: McpFileMetadata }> {
    this.assertWithinRoot(filePath);

    const stat = await fsp.stat(filePath);
    const content = await fsp.readFile(filePath, 'utf-8');

    const name = path.basename(filePath);
    const ext = path.extname(name).toLowerCase();

    return {
      content,
      metadata: {
        name,
        path: filePath,
        sizeBytes: stat.size,
        mtime: stat.mtime.toISOString(),
        extension: ext,
      },
    };
  }

  async moveFile(sourcePath: string, destPath: string): Promise<void> {
    this.assertWithinRoot(sourcePath);
    this.assertWithinRoot(destPath);

    const destDir = path.dirname(destPath);
    await fsp.mkdir(destDir, { recursive: true });
    await fsp.rename(sourcePath, destPath);
  }

  getRootDir(): string {
    return this.rootDir;
  }
}

let mcpClientInstance: McpFilesystemClient | null = null;

export function getMcpClient(): McpFilesystemClient {
  if (!mcpClientInstance) {
    const rootDir = process.env['IMPORT_DIR'];
    if (!rootDir) throw new Error('IMPORT_DIR environment variable is not set');
    mcpClientInstance = new McpFilesystemClient(rootDir);
  }
  return mcpClientInstance;
}
