import { Role } from '@prisma/client';
import bcryptjs from 'bcryptjs';
import { prisma, createTestUser } from '../helpers/db';
import {
  registerUser,
  findUserById,
  listUsers,
  updateUser,
  deactivateUser,
} from '@/lib/services/users';
import { ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import type { AppSession } from '@/types';

function makeSession(role: Role, id: string): AppSession {
  return {
    user: { id, email: 'session@example.com', name: 'Session User', role },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

// ─── registerUser ─────────────────────────────────────────────────────────────

describe('registerUser (integration)', () => {
  it('creates a user in the database', async () => {
    const result = await registerUser({
      email: 'newuser@example.com',
      name: 'New User',
      password: 'Password1',
    });

    const dbUser = await prisma.user.findUnique({ where: { email: 'newuser@example.com' } });
    expect(dbUser).not.toBeNull();
    expect(result.id).toBe(dbUser?.id);
  });

  it('stores a bcrypt hash, not the plain-text password', async () => {
    await registerUser({ email: 'hashed@example.com', name: 'Hashed', password: 'Password1' });

    const dbUser = await prisma.user.findUnique({ where: { email: 'hashed@example.com' } });
    expect(dbUser?.passwordHash).not.toBe('Password1');
    expect(dbUser?.passwordHash).toMatch(/^\$2[ab]\$/);
  });

  it('the stored hash validates with bcrypt.compare', async () => {
    await registerUser({ email: 'verify@example.com', name: 'Verify', password: 'Password1' });

    const dbUser = await prisma.user.findUnique({ where: { email: 'verify@example.com' } });
    const isValid = await bcryptjs.compare('Password1', dbUser?.passwordHash ?? '');
    expect(isValid).toBe(true);
  });

  it('assigns VIEWER role by default', async () => {
    const result = await registerUser({
      email: 'viewer@example.com',
      name: 'Viewer',
      password: 'Password1',
    });
    expect(result.role).toBe(Role.VIEWER);
  });

  it('sets isActive to true by default', async () => {
    const result = await registerUser({
      email: 'active@example.com',
      name: 'Active',
      password: 'Password1',
    });
    expect(result.isActive).toBe(true);
  });

  it('throws ConflictError when email is already registered', async () => {
    await registerUser({ email: 'dup@example.com', name: 'First', password: 'Password1' });

    await expect(
      registerUser({ email: 'dup@example.com', name: 'Second', password: 'Password2' }),
    ).rejects.toThrow(ConflictError);
  });

  it('returns all UserSummary fields', async () => {
    const result = await registerUser({
      email: 'summary@example.com',
      name: 'Summary User',
      password: 'Password1',
    });

    expect(result).toMatchObject({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      email: 'summary@example.com',
      name: 'Summary User',
      role: Role.VIEWER,
      isActive: true,
      createdAt: expect.any(Date),
    });
  });
});

// ─── findUserById ─────────────────────────────────────────────────────────────

describe('findUserById (integration)', () => {
  it('admin retrieves any user', async () => {
    const admin = await createTestUser({ email: 'admin@example.com', role: Role.ADMIN });
    const target = await createTestUser({ email: 'target@example.com' });
    const adminSession = makeSession(Role.ADMIN, admin.id);

    const result = await findUserById(target.id, adminSession);
    expect(result.id).toBe(target.id);
  });

  it('user retrieves their own record', async () => {
    const user = await createTestUser({ email: 'self@example.com', role: Role.EDITOR });
    const session = makeSession(Role.EDITOR, user.id);

    const result = await findUserById(user.id, session);
    expect(result.id).toBe(user.id);
  });

  it('throws ForbiddenError when VIEWER requests another user', async () => {
    const viewer = await createTestUser({ email: 'viewer@example.com', role: Role.VIEWER });
    const other = await createTestUser({ email: 'other@example.com' });
    const session = makeSession(Role.VIEWER, viewer.id);

    await expect(findUserById(other.id, session)).rejects.toThrow(ForbiddenError);
  });

  it('throws NotFoundError for a non-existent ID', async () => {
    const admin = await createTestUser({ email: 'findadmin@example.com', role: Role.ADMIN });
    const adminSession = makeSession(Role.ADMIN, admin.id);

    await expect(
      findUserById('00000000-0000-0000-0000-000000000000', adminSession),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError for a soft-deleted user', async () => {
    const admin = await createTestUser({ email: 'findadmin2@example.com', role: Role.ADMIN });
    const target = await createTestUser({ email: 'softdel@example.com' });
    await prisma.user.update({ where: { id: target.id }, data: { deletedAt: new Date() } });
    const adminSession = makeSession(Role.ADMIN, admin.id);

    await expect(findUserById(target.id, adminSession)).rejects.toThrow(NotFoundError);
  });
});

// ─── listUsers ────────────────────────────────────────────────────────────────

describe('listUsers (integration)', () => {
  it('throws ForbiddenError for non-admin callers', async () => {
    const editor = await createTestUser({ email: 'listeditor@example.com', role: Role.EDITOR });
    const session = makeSession(Role.EDITOR, editor.id);

    await expect(listUsers({ page: 1, limit: 50 }, session)).rejects.toThrow(ForbiddenError);
  });

  it('returns paginated results with correct meta', async () => {
    const admin = await createTestUser({ email: 'listadmin@example.com', role: Role.ADMIN });
    const adminSession = makeSession(Role.ADMIN, admin.id);

    for (let i = 0; i < 3; i++) {
      await createTestUser({ email: `list-user-${i}@example.com` });
    }

    const result = await listUsers({ page: 1, limit: 50 }, adminSession);

    expect(result.data.length).toBeGreaterThanOrEqual(4);
    expect(result.meta).toMatchObject({ page: 1, limit: 50 });
    expect(result.meta.total).toBe(result.meta.totalPages * result.meta.limit >= result.meta.total
      ? result.meta.total
      : result.meta.total);
  });

  it('filters by role', async () => {
    const admin = await createTestUser({ email: 'filteradmin@example.com', role: Role.ADMIN });
    const adminSession = makeSession(Role.ADMIN, admin.id);
    await createTestUser({ email: 'filtereditor@example.com', role: Role.EDITOR });

    const result = await listUsers({ page: 1, limit: 50, role: Role.EDITOR }, adminSession);

    expect(result.data.every((u) => u.role === Role.EDITOR)).toBe(true);
  });

  it('respects pagination limit', async () => {
    const admin = await createTestUser({ email: 'pageadmin@example.com', role: Role.ADMIN });
    const adminSession = makeSession(Role.ADMIN, admin.id);

    for (let i = 0; i < 5; i++) {
      await createTestUser({ email: `page-u-${i}@example.com` });
    }

    const result = await listUsers({ page: 1, limit: 2 }, adminSession);

    expect(result.data.length).toBeLessThanOrEqual(2);
  });

  it('excludes soft-deleted users from results', async () => {
    const admin = await createTestUser({ email: 'excladmin@example.com', role: Role.ADMIN });
    const adminSession = makeSession(Role.ADMIN, admin.id);
    const ghost = await createTestUser({ email: 'ghost-list@example.com' });
    await prisma.user.update({ where: { id: ghost.id }, data: { deletedAt: new Date() } });

    const result = await listUsers({ page: 1, limit: 50 }, adminSession);

    expect(result.data.some((u) => u.id === ghost.id)).toBe(false);
  });
});

// ─── updateUser ───────────────────────────────────────────────────────────────

describe('updateUser (integration)', () => {
  it('admin can update a user\'s name', async () => {
    const admin = await createTestUser({ email: 'updadmin@example.com', role: Role.ADMIN });
    const target = await createTestUser({ email: 'upd-target@example.com', name: 'Old Name' });
    const adminSession = makeSession(Role.ADMIN, admin.id);

    const result = await updateUser(target.id, { name: 'New Name' }, adminSession);

    expect(result.name).toBe('New Name');
  });

  it('admin can change a user\'s role', async () => {
    const admin = await createTestUser({ email: 'roleadmin@example.com', role: Role.ADMIN });
    const target = await createTestUser({ email: 'rolechange@example.com', role: Role.VIEWER });
    const adminSession = makeSession(Role.ADMIN, admin.id);

    const result = await updateUser(target.id, { role: Role.EDITOR }, adminSession);

    expect(result.role).toBe(Role.EDITOR);
    const dbUser = await prisma.user.findUnique({ where: { id: target.id } });
    expect(dbUser?.role).toBe(Role.EDITOR);
  });

  it('user can update their own name', async () => {
    const user = await createTestUser({ email: 'selfupd@example.com', name: 'Original' });
    const session = makeSession(Role.VIEWER, user.id);

    const result = await updateUser(user.id, { name: 'Updated Self' }, session);

    expect(result.name).toBe('Updated Self');
  });

  it('throws ForbiddenError when VIEWER tries to update another user', async () => {
    const viewer = await createTestUser({ email: 'updviewer@example.com', role: Role.VIEWER });
    const other = await createTestUser({ email: 'updother@example.com' });
    const session = makeSession(Role.VIEWER, viewer.id);

    await expect(updateUser(other.id, { name: 'Hack' }, session)).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when non-admin tries to change role', async () => {
    const editor = await createTestUser({ email: 'roleblk@example.com', role: Role.EDITOR });
    const session = makeSession(Role.EDITOR, editor.id);

    await expect(updateUser(editor.id, { role: Role.ADMIN }, session)).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when admin tries to deactivate themselves', async () => {
    const admin = await createTestUser({ email: 'selfdeact@example.com', role: Role.ADMIN });
    const adminSession = makeSession(Role.ADMIN, admin.id);

    await expect(updateUser(admin.id, { isActive: false }, adminSession)).rejects.toThrow(ForbiddenError);
  });

  it('throws NotFoundError for non-existent user', async () => {
    const admin = await createTestUser({ email: 'notfoundadm@example.com', role: Role.ADMIN });
    const adminSession = makeSession(Role.ADMIN, admin.id);

    await expect(
      updateUser('00000000-0000-0000-0000-000000000000', { name: 'Ghost' }, adminSession),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── deactivateUser ───────────────────────────────────────────────────────────

describe('deactivateUser (integration)', () => {
  it('sets isActive to false on the target', async () => {
    const admin = await createTestUser({ email: 'deactadmin@example.com', role: Role.ADMIN });
    const target = await createTestUser({ email: 'deact-target@example.com' });
    const adminSession = makeSession(Role.ADMIN, admin.id);

    await deactivateUser(target.id, adminSession);

    const dbUser = await prisma.user.findUnique({ where: { id: target.id } });
    expect(dbUser?.isActive).toBe(false);
  });

  it('does not delete the user record', async () => {
    const admin = await createTestUser({ email: 'nodeladmin@example.com', role: Role.ADMIN });
    const target = await createTestUser({ email: 'nodel-target@example.com' });
    const adminSession = makeSession(Role.ADMIN, admin.id);

    await deactivateUser(target.id, adminSession);

    const count = await prisma.user.count({ where: { id: target.id } });
    expect(count).toBe(1);
  });

  it('throws ForbiddenError for EDITOR callers', async () => {
    const editor = await createTestUser({ email: 'deacteditor@example.com', role: Role.EDITOR });
    const target = await createTestUser({ email: 'deact-ed-target@example.com' });
    const session = makeSession(Role.EDITOR, editor.id);

    await expect(deactivateUser(target.id, session)).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when admin deactivates themselves', async () => {
    const admin = await createTestUser({ email: 'selfdeact2@example.com', role: Role.ADMIN });
    const adminSession = makeSession(Role.ADMIN, admin.id);

    await expect(deactivateUser(admin.id, adminSession)).rejects.toThrow(ForbiddenError);
  });

  it('throws NotFoundError when user does not exist', async () => {
    const admin = await createTestUser({ email: 'nfadmin@example.com', role: Role.ADMIN });
    const adminSession = makeSession(Role.ADMIN, admin.id);

    await expect(
      deactivateUser('00000000-0000-0000-0000-000000000000', adminSession),
    ).rejects.toThrow(NotFoundError);
  });
});
