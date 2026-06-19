import bcryptjs from 'bcryptjs';
import { db } from '@/lib/db/client';
import type { Role } from '@prisma/client';

type VerifiedUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<VerifiedUser | null> {
  if (!email || !password) return null;

  const user = await db.user.findUnique({
    where: { email, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      passwordHash: true,
      deletedAt: true,
    },
  });

  if (!user || !user.isActive || !user.passwordHash || user.deletedAt !== null) return null;

  const passwordMatches = await bcryptjs.compare(password, user.passwordHash);
  if (!passwordMatches) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
