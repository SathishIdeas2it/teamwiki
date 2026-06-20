import { auth } from '@/lib/auth/config';
import { ForbiddenError, UnauthorizedError, handleRouteError } from '@/lib/errors';
import { getMcpClient } from '@/lib/mcp/client';
import { runImportPipeline } from '@/lib/mcp/importer';
import type { AppSession } from '@/types';

export async function POST(_req: Request): Promise<Response> {
  try {
    const session = (await auth()) as AppSession | null;
    if (!session) throw new UnauthorizedError();
    if (session.user.role !== 'ADMIN') throw new ForbiddenError('Admin access required');

    const client = getMcpClient();
    const files = await client.listFiles();

    const counts = { imported: 0, skipped: 0, failed: 0 };
    for (const file of files) {
      const result = await runImportPipeline(file.path);
      counts[result]++;
    }

    return Response.json({ results: counts });
  } catch (err) {
    return handleRouteError(err);
  }
}
