import bcryptjs from 'bcryptjs';
import { Role } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { requirePermission } from '@/lib/auth/permissions';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/errors';
import type { AppSession, UserSummary, PaginatedResult } from '@/types';
import type { CreateUserInput, UpdateUserInput, UserListQuery } from '@/lib/validations/user';

// Cheaper rounds in test so the suite stays fast without mocking bcrypt.
const BCRYPT_ROUNDS = process.env['NODE_ENV'] === 'test' ? 1 : 12;

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
  );
}

export async function registerUser(data: CreateUserInput): Promise<UserSummary> {
  const passwordHash = await bcryptjs.hash(data.password, BCRYPT_ROUNDS);

  try {
    return await db.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
        role: Role.VIEWER,
        isActive: true,
      },
      select: USER_SELECT,
    });
  } catch (err) {
    if (isPrismaUniqueConstraintError(err)) {
      throw new ConflictError('Email address is already registered');
    }
    throw err;
  }
}

export async function findUserById(
  id: string,
  session: AppSession,
): Promise<UserSummary> {
  const isSelf = session.user.id === id;
  const isAdmin = session.user.role === 'ADMIN';

  if (!isSelf && !isAdmin) {
    throw new ForbiddenError('You may only view your own profile');
  }

  const user = await db.user.findUnique({
    where: { id, deletedAt: null },
    select: USER_SELECT,
  });

  if (!user) throw new NotFoundError('User not found');
  return user;
}

export async function listUsers(
  query: UserListQuery,
  session: AppSession,
): Promise<PaginatedResult<UserSummary>> {
  requirePermission(session, 'admin:access');

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(query.role !== undefined ? { role: query.role } : {}),
  };

  const skip = (query.page - 1) * query.limit;

  const [total, users] = await db.$transaction([
    db.user.count({ where }),
    db.user.findMany({
      where,
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
  ]);

  return {
    data: users,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function updateUser(
  id: string,
  data: UpdateUserInput,
  session: AppSession,
): Promise<UserSummary> {
  const target = await db.user.findUnique({ where: { id, deletedAt: null }, select: { id: true } });
  if (!target) throw new NotFoundError('User not found');

  const isSelf = session.user.id === id;
  const isAdmin = session.user.role === 'ADMIN';

  // Role and isActive changes require admin permission
  if ((data.role !== undefined || data.isActive !== undefined) && !isAdmin) {
    throw new ForbiddenError('Only admins may change role or active status');
  }

  // Nobody may deactivate their own account
  if (isSelf && data.isActive === false) {
    throw new ForbiddenError('You cannot deactivate your own account');
  }

  // Name changes require being either an admin or the account owner
  if (data.name !== undefined && !isAdmin && !isSelf) {
    throw new ForbiddenError('You may only update your own profile');
  }

  const updateData: Prisma.UserUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return db.user.update({
    where: { id },
    data: updateData,
    select: USER_SELECT,
  });
}

export async function deactivateUser(id: string, session: AppSession): Promise<void> {
  requirePermission(session, 'user:manage');

  if (session.user.id === id) {
    throw new ForbiddenError('You cannot deactivate your own account');
  }

  const target = await db.user.findUnique({ where: { id, deletedAt: null }, select: { id: true } });
  if (!target) throw new NotFoundError('User not found');

  await db.user.update({ where: { id }, data: { isActive: false } });
}
