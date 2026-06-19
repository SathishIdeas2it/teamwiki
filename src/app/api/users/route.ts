import { auth } from '@/lib/auth/config';
import { handleRouteError, UnauthorizedError, ValidationError } from '@/lib/errors';
import { listUsers } from '@/lib/services/users';
import { userListQuerySchema } from '@/lib/validations/user';
import type { AppSession } from '@/types';

export async function GET(req: Request): Promise<Response> {
  try {
    const session = (await auth()) as AppSession | null;
    if (!session) throw new UnauthorizedError();

    const { searchParams } = new URL(req.url);
    const parsed = userListQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) throw new ValidationError('Invalid query parameters', parsed.error.issues);

    const result = await listUsers(parsed.data, session);
    return Response.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
