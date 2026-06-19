import { auth } from '@/lib/auth/config';
import { handleRouteError, UnauthorizedError } from '@/lib/errors';
import { findById } from '@/lib/services/revisions';
import type { AppSession } from '@/types';

type RouteContext = { params: Promise<{ revisionId: string }> };

export async function GET(_req: Request, { params }: RouteContext): Promise<Response> {
  try {
    const session = (await auth()) as AppSession | null;
    if (!session) throw new UnauthorizedError();
    const { revisionId } = await params;

    const revision = await findById(revisionId, session);
    return Response.json(revision);
  } catch (err) {
    return handleRouteError(err);
  }
}
