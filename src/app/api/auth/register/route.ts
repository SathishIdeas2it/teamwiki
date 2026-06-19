import { createUserSchema } from '@/lib/validations/user';
import { registerUser } from '@/lib/services/users';
import { handleRouteError, ValidationError } from '@/lib/errors';

export async function POST(req: Request): Promise<Response> {
  try {
    const body: unknown = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError('Invalid request body', parsed.error.issues);
    }

    const user = await registerUser(parsed.data);
    return Response.json(user, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
