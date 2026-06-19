import type { McpFileMetadata } from '@/types';

export class McpFilesystemClient {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  async listFiles(): Promise<McpFileMetadata[]> {
    throw new Error('Not implemented');
  }

  async readFile(path: string): Promise<{ content: string; metadata: McpFileMetadata }> {
    void path;
    throw new Error('Not implemented');
  }

  async moveFile(sourcePath: string, destPath: string): Promise<void> {
    void sourcePath;
    void destPath;
    throw new Error('Not implemented');
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
