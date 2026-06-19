import { auth } from '@/lib/auth/config';
import { handleRouteError, UnauthorizedError, ValidationError } from '@/lib/errors';
import { updateTag, deleteTag } from '@/lib/services/tags';
import { updateTagSchema } from '@/lib/validations/tag';
import type { AppSession } from '@/types';

type RouteContext = { params: Promise<{ slug: string }> };

export async function PATCH(req: Request, { params }: RouteContext): Promise<Response> {
  try {
    const session = (await auth()) as AppSession | null;
    if (!session) throw new UnauthorizedError();
    const { slug } = await params;

    const body: unknown = await req.json();
    const parsed = updateTagSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid request body', parsed.error.issues);

    const tag = await updateTag(slug, parsed.data, session);
    return Response.json(tag);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: Request, { params }: RouteContext): Promise<Response> {
  try {
    const session = (await auth()) as AppSession | null;
    if (!session) throw new UnauthorizedError();
    const { slug } = await params;
    await deleteTag(slug, session);
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
