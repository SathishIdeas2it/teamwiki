import { auth } from '@/lib/auth/config';
import { handleRouteError, UnauthorizedError, ValidationError } from '@/lib/errors';
import { getArticleBySlug, updateArticle, deleteArticle } from '@/lib/services/articles';
import { updateArticleSchema } from '@/lib/validations/article';
import type { AppSession } from '@/types';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: RouteContext): Promise<Response> {
  try {
    const session = (await auth()) as AppSession | null;
    if (!session) throw new UnauthorizedError();
    const { slug } = await params;
    const article = await getArticleBySlug(slug, session);
    return Response.json(article);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request, { params }: RouteContext): Promise<Response> {
  try {
    const session = (await auth()) as AppSession | null;
    if (!session) throw new UnauthorizedError();
    const { slug } = await params;

    const body: unknown = await req.json();
    const parsed = updateArticleSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid request body', parsed.error.issues);

    const article = await updateArticle(slug, parsed.data, session);
    return Response.json(article);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: Request, { params }: RouteContext): Promise<Response> {
  try {
    const session = (await auth()) as AppSession | null;
    if (!session) throw new UnauthorizedError();
    const { slug } = await params;
    await deleteArticle(slug, session);
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
