import { auth } from '@/lib/auth/config';
import { handleRouteError, UnauthorizedError, NotFoundError } from '@/lib/errors';
import { getArticleBySlug } from '@/lib/services/articles';
import { listByArticle } from '@/lib/services/revisions';
import type { AppSession } from '@/types';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: RouteContext): Promise<Response> {
  try {
    const session = (await auth()) as AppSession | null;
    if (!session) throw new UnauthorizedError();
    const { slug } = await params;

    const article = await getArticleBySlug(slug, session);
    if (!article) throw new NotFoundError();

    const revisions = await listByArticle(article.id, session);
    return Response.json({ revisions });
  } catch (err) {
    return handleRouteError(err);
  }
}
