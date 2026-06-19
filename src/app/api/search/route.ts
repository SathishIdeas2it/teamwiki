import { auth } from '@/lib/auth/config';
import { handleRouteError, UnauthorizedError, ValidationError } from '@/lib/errors';
import { search } from '@/lib/services/search';
import { searchQuerySchema } from '@/lib/validations/tag';
import type { AppSession } from '@/types';

export async function GET(req: Request): Promise<Response> {
  try {
    const session = (await auth()) as AppSession | null;
    if (!session) throw new UnauthorizedError();

    const { searchParams } = new URL(req.url);
    const parsed = searchQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) throw new ValidationError('Invalid query parameters', parsed.error.issues);

    const results = await search(parsed.data, session);
    return Response.json({ ...results, query: parsed.data.q });
  } catch (err) {
    return handleRouteError(err);
  }
}
