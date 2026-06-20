/**
 * @jest-environment node
 */
jest.mock('@/lib/auth/config', () => ({ auth: jest.fn() }));
jest.mock('@/lib/mcp/client');
jest.mock('@/lib/mcp/importer');

import { POST } from '@/app/api/mcp/import/route';
import { auth } from '@/lib/auth/config';
import { getMcpClient } from '@/lib/mcp/client';
import { runImportPipeline } from '@/lib/mcp/importer';
import { Role } from '@prisma/client';
import type { AppSession } from '@/types';
import type { McpFileMetadata } from '@/types';

const mockAuth = auth as jest.Mock;
const mockGetMcpClient = getMcpClient as jest.Mock;
const mockRunImportPipeline = runImportPipeline as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(role: Role): AppSession {
  return {
    user: { id: 'user-uuid-1', email: 'test@example.com', name: 'Test User', role },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

function makeFileMetadata(name: string): McpFileMetadata {
  return {
    name,
    path: `/imports/${name}`,
    sizeBytes: 1024,
    mtime: new Date().toISOString(),
    extension: '.md',
  };
}

function makeMockClient(files: McpFileMetadata[] = []) {
  return { listFiles: jest.fn().mockResolvedValue(files) };
}

function makeRequest(): Request {
  return new Request('http://localhost/api/mcp/import', { method: 'POST' });
}

// ─── POST /api/mcp/import ────────────────────────────────────────────────────

describe('POST /api/mcp/import', () => {
  describe('authentication', () => {
    it('returns 401 when no session exists', async () => {
      mockAuth.mockResolvedValue(null);

      const res = await POST(makeRequest());

      expect(res.status).toBe(401);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('authorization', () => {
    it('returns 403 when session role is EDITOR', async () => {
      mockAuth.mockResolvedValue(makeSession(Role.EDITOR));

      const res = await POST(makeRequest());

      expect(res.status).toBe(403);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('returns 403 when session role is VIEWER', async () => {
      mockAuth.mockResolvedValue(makeSession(Role.VIEWER));

      const res = await POST(makeRequest());

      expect(res.status).toBe(403);
    });
  });

  describe('successful import scan', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(makeSession(Role.ADMIN));
    });

    it('returns 200 with zero counts when no files found', async () => {
      mockGetMcpClient.mockReturnValue(makeMockClient([]));

      const res = await POST(makeRequest());

      expect(res.status).toBe(200);
      const body = await res.json() as { results: { imported: number; skipped: number; failed: number } };
      expect(body.results).toEqual({ imported: 0, skipped: 0, failed: 0 });
    });

    it('runs runImportPipeline for each discovered file', async () => {
      const files = [makeFileMetadata('doc1.md'), makeFileMetadata('doc2.md')];
      mockGetMcpClient.mockReturnValue(makeMockClient(files));
      mockRunImportPipeline.mockResolvedValue('imported');

      await POST(makeRequest());

      expect(mockRunImportPipeline).toHaveBeenCalledTimes(2);
      expect(mockRunImportPipeline).toHaveBeenCalledWith('/imports/doc1.md');
      expect(mockRunImportPipeline).toHaveBeenCalledWith('/imports/doc2.md');
    });

    it('tallies imported, skipped, and failed results correctly', async () => {
      const files = [
        makeFileMetadata('a.md'),
        makeFileMetadata('b.md'),
        makeFileMetadata('c.md'),
        makeFileMetadata('d.md'),
      ];
      mockGetMcpClient.mockReturnValue(makeMockClient(files));
      mockRunImportPipeline
        .mockResolvedValueOnce('imported')
        .mockResolvedValueOnce('imported')
        .mockResolvedValueOnce('skipped')
        .mockResolvedValueOnce('failed');

      const res = await POST(makeRequest());

      expect(res.status).toBe(200);
      const body = await res.json() as { results: { imported: number; skipped: number; failed: number } };
      expect(body.results).toEqual({ imported: 2, skipped: 1, failed: 1 });
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue(makeSession(Role.ADMIN));
    });

    it('returns 500 when listFiles throws an unexpected error', async () => {
      const mockClient = { listFiles: jest.fn().mockRejectedValue(new Error('disk error')) };
      mockGetMcpClient.mockReturnValue(mockClient);

      const res = await POST(makeRequest());

      expect(res.status).toBe(500);
      const body = await res.json() as { error: { code: string } };
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
