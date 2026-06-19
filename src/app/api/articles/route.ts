import { auth } from '@/lib/auth/config';
import { handleRouteError, UnauthorizedError, ValidationError } from '@/lib/errors';
import { listArticles, createArticle } from '@/lib/services/articles';
import { articleListQuerySchema, createArticleSchema } from '@/lib/validations/article';
import type { AppSession } from '@/types';

export async function GET(req: Request): Promise<Response> {
  try {
    const session = (await auth()) as AppSession | null;
    if (!session) throw new UnauthorizedError();

    const { searchParams } = new URL(req.url);
    const query = articleListQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!query.success) throw new ValidationError('Invalid query parameters', query.error.issues);

    const result = await listArticles(query.data, session);
    return Response.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const session = (await auth()) as AppSession | null;
    if (!session) throw new UnauthorizedError();

    const body: unknown = await req.json();
    const parsed = createArticleSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid request body', parsed.error.issues);

    const article = await createArticle(parsed.data, session);
    return Response.json(article, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
