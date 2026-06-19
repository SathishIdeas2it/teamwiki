import { auth } from '@/lib/auth/config';
import { handleRouteError, UnauthorizedError } from '@/lib/errors';
import { listArticlesByTag } from '@/lib/services/tags';
import type { AppSession } from '@/types';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: RouteContext): Promise<Response> {
  try {
    const session = (await auth()) as AppSession | null;
    if (!session) throw new UnauthorizedError();
    const { slug } = await params;
    const { searchParams } = new URL(req.url);

    const page = Number(searchParams.get('page') ?? 1);
    const limit = Number(searchParams.get('limit') ?? 20);

    const result = await listArticlesByTag(slug, page, limit, session);
    return Response.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
