import { auth } from '@/lib/auth/config';
import { handleRouteError, UnauthorizedError, ValidationError } from '@/lib/errors';
import { listTags, createTag } from '@/lib/services/tags';
import { createTagSchema } from '@/lib/validations/tag';
import type { AppSession } from '@/types';

export async function GET(_req: Request): Promise<Response> {
  try {
    const session = (await auth()) as AppSession | null;
    if (!session) throw new UnauthorizedError();
    const tags = await listTags(session);
    return Response.json({ tags });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const session = (await auth()) as AppSession | null;
    if (!session) throw new UnauthorizedError();

    const body: unknown = await req.json();
    const parsed = createTagSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid request body', parsed.error.issues);

    const tag = await createTag(parsed.data, session);
    return Response.json(tag, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
