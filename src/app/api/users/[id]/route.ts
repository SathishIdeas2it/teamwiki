import { auth } from '@/lib/auth/config';
import { handleRouteError, UnauthorizedError, ValidationError } from '@/lib/errors';
import { findUserById, updateUser, deactivateUser } from '@/lib/services/users';
import { updateUserSchema } from '@/lib/validations/user';
import type { AppSession } from '@/types';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext): Promise<Response> {
  try {
    const session = (await auth()) as AppSession | null;
    if (!session) throw new UnauthorizedError();
    const { id } = await params;
    const user = await findUserById(id, session);
    return Response.json(user);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: Request, { params }: RouteContext): Promise<Response> {
  try {
    const session = (await auth()) as AppSession | null;
    if (!session) throw new UnauthorizedError();
    const { id } = await params;

    const body: unknown = await req.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) throw new ValidationError('Invalid request body', parsed.error.issues);

    const user = await updateUser(id, parsed.data, session);
    return Response.json(user);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: Request, { params }: RouteContext): Promise<Response> {
  try {
    const session = (await auth()) as AppSession | null;
    if (!session) throw new UnauthorizedError();
    const { id } = await params;
    await deactivateUser(id, session);
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
