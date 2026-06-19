import { prismaMock } from '../../setup';
import { Role } from '@prisma/client';
import {
  registerUser,
  findUserById,
  listUsers,
  updateUser,
  deactivateUser,
} from '@/lib/services/users';
import { ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import type { AppSession } from '@/types';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$01$mockedhash'),
  compare: jest.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(role: Role, id = 'session-user-id'): AppSession {
  return {
    user: { id, email: 'session@example.com', name: 'Session User', role },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

function makeDbUser(overrides: Partial<{
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
}> = {}) {
  return {
    id: 'db-user-id',
    email: 'user@example.com',
    name: 'DB User',
    role: Role.VIEWER,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function makePrismaUniqueError(): Error & { code: string } {
  const err = Object.assign(
    new Error('Unique constraint failed on the fields: (`email`)'),
    { code: 'P2002' },
  );
  return err;
}

// ─── registerUser ─────────────────────────────────────────────────────────────

describe('registerUser', () => {
  it('hashes the password before storing it', async () => {
    const { hash } = await import('bcryptjs');
    prismaMock.user.create.mockResolvedValueOnce(makeDbUser());

    await registerUser({ email: 'new@example.com', name: 'New User', password: 'Password1' });

    expect(hash).toHaveBeenCalledWith('Password1', expect.any(Number));
  });

  it('creates the user with VIEWER role regardless of input', async () => {
    prismaMock.user.create.mockResolvedValueOnce(makeDbUser({ role: Role.VIEWER }));

    await registerUser({ email: 'new@example.com', name: 'New User', password: 'Password1' });

    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: Role.VIEWER }),
      }),
    );
  });

  it('returns a UserSummary without the password hash', async () => {
    const dbUser = makeDbUser({ email: 'new@example.com', name: 'New User' });
    prismaMock.user.create.mockResolvedValueOnce(dbUser);

    const result = await registerUser({ email: 'new@example.com', name: 'New User', password: 'Password1' });

    expect(result).toMatchObject({
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: Role.VIEWER,
      isActive: true,
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('throws ConflictError when email is already taken', async () => {
    prismaMock.user.create.mockRejectedValueOnce(makePrismaUniqueError());

    await expect(
      registerUser({ email: 'taken@example.com', name: 'Dup', password: 'Password1' }),
    ).rejects.toThrow(ConflictError);
  });

  it('ConflictError has statusCode 409', async () => {
    prismaMock.user.create.mockRejectedValueOnce(makePrismaUniqueError());

    try {
      await registerUser({ email: 'taken@example.com', name: 'Dup', password: 'Password1' });
      fail('expected ConflictError');
    } catch (err) {
      expect((err as ConflictError).statusCode).toBe(409);
    }
  });

  it('re-throws non-unique-constraint database errors', async () => {
    const dbError = new Error('connection refused');
    prismaMock.user.create.mockRejectedValueOnce(dbError);

    await expect(
      registerUser({ email: 'new@example.com', name: 'New', password: 'Password1' }),
    ).rejects.toThrow('connection refused');
  });
});

// ─── findUserById ─────────────────────────────────────────────────────────────

describe('findUserById', () => {
  it('returns the user for an ADMIN looking up any user', async () => {
    const adminSession = makeSession(Role.ADMIN, 'admin-id');
    const target = makeDbUser({ id: 'target-id' });
    prismaMock.user.findUnique.mockResolvedValueOnce(target);

    const result = await findUserById('target-id', adminSession);

    expect(result.id).toBe('target-id');
  });

  it('returns the user when a non-admin looks up themselves', async () => {
    const editorSession = makeSession(Role.EDITOR, 'self-id');
    const self = makeDbUser({ id: 'self-id', role: Role.EDITOR });
    prismaMock.user.findUnique.mockResolvedValueOnce(self);

    const result = await findUserById('self-id', editorSession);

    expect(result.id).toBe('self-id');
  });

  it('throws ForbiddenError when a VIEWER looks up another user', async () => {
    const viewerSession = makeSession(Role.VIEWER, 'viewer-id');

    await expect(findUserById('other-id', viewerSession)).rejects.toThrow(ForbiddenError);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when an EDITOR looks up another user', async () => {
    const editorSession = makeSession(Role.EDITOR, 'editor-id');

    await expect(findUserById('other-id', editorSession)).rejects.toThrow(ForbiddenError);
  });

  it('throws NotFoundError when user does not exist', async () => {
    const adminSession = makeSession(Role.ADMIN);
    prismaMock.user.findUnique.mockResolvedValueOnce(null);

    await expect(findUserById('ghost-id', adminSession)).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when user is soft-deleted', async () => {
    const adminSession = makeSession(Role.ADMIN);
    prismaMock.user.findUnique.mockResolvedValueOnce(null);

    await expect(findUserById('deleted-id', adminSession)).rejects.toThrow(NotFoundError);
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });
});

// ─── listUsers ────────────────────────────────────────────────────────────────

describe('listUsers', () => {
  const adminSession = makeSession(Role.ADMIN);

  it('throws ForbiddenError when called by EDITOR', async () => {
    const editorSession = makeSession(Role.EDITOR);
    await expect(listUsers({ page: 1, limit: 50 }, editorSession)).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when called by VIEWER', async () => {
    const viewerSession = makeSession(Role.VIEWER);
    await expect(listUsers({ page: 1, limit: 50 }, viewerSession)).rejects.toThrow(ForbiddenError);
  });

  it('returns paginated result for ADMIN', async () => {
    const users = [makeDbUser({ id: 'u1' }), makeDbUser({ id: 'u2' })];
    prismaMock.$transaction.mockResolvedValueOnce([2, users]);

    const result = await listUsers({ page: 1, limit: 50 }, adminSession);

    expect(result.data).toHaveLength(2);
    expect(result.meta).toMatchObject({ total: 2, page: 1, limit: 50, totalPages: 1 });
  });

  it('calculates totalPages correctly', async () => {
    const users = Array.from({ length: 10 }, (_, i) => makeDbUser({ id: `u${i}` }));
    prismaMock.$transaction.mockResolvedValueOnce([23, users]);

    const result = await listUsers({ page: 1, limit: 10 }, adminSession);

    expect(result.meta.totalPages).toBe(3);
  });

  it('applies role filter when provided', async () => {
    prismaMock.$transaction.mockResolvedValueOnce([1, [makeDbUser({ role: Role.EDITOR })]]);

    await listUsers({ page: 1, limit: 50, role: Role.EDITOR }, adminSession);

    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it('excludes soft-deleted users', async () => {
    prismaMock.$transaction.mockResolvedValueOnce([0, []]);

    await listUsers({ page: 1, limit: 50 }, adminSession);

    expect(prismaMock.$transaction).toHaveBeenCalled();
  });
});

// ─── updateUser ───────────────────────────────────────────────────────────────

describe('updateUser', () => {
  it('allows ADMIN to update another user\'s name', async () => {
    const adminSession = makeSession(Role.ADMIN, 'admin-id');
    const target = makeDbUser({ id: 'target-id' });
    prismaMock.user.findUnique.mockResolvedValueOnce(target);
    prismaMock.user.update.mockResolvedValueOnce({ ...target, name: 'New Name' });

    const result = await updateUser('target-id', { name: 'New Name' }, adminSession);

    expect(result.name).toBe('New Name');
  });

  it('allows ADMIN to change another user\'s role', async () => {
    const adminSession = makeSession(Role.ADMIN, 'admin-id');
    const target = makeDbUser({ id: 'target-id', role: Role.VIEWER });
    prismaMock.user.findUnique.mockResolvedValueOnce(target);
    prismaMock.user.update.mockResolvedValueOnce({ ...target, role: Role.EDITOR });

    const result = await updateUser('target-id', { role: Role.EDITOR }, adminSession);

    expect(result.role).toBe(Role.EDITOR);
  });

  it('allows an EDITOR to update their own name', async () => {
    const editorSession = makeSession(Role.EDITOR, 'editor-id');
    const self = makeDbUser({ id: 'editor-id', role: Role.EDITOR });
    prismaMock.user.findUnique.mockResolvedValueOnce(self);
    prismaMock.user.update.mockResolvedValueOnce({ ...self, name: 'Updated Name' });

    const result = await updateUser('editor-id', { name: 'Updated Name' }, editorSession);

    expect(result.name).toBe('Updated Name');
  });

  it('throws ForbiddenError when EDITOR tries to change another user\'s name', async () => {
    const editorSession = makeSession(Role.EDITOR, 'editor-id');
    const target = makeDbUser({ id: 'other-id' });
    prismaMock.user.findUnique.mockResolvedValueOnce(target);

    await expect(
      updateUser('other-id', { name: 'Hacked Name' }, editorSession),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when non-admin tries to change a role', async () => {
    const editorSession = makeSession(Role.EDITOR, 'editor-id');
    const self = makeDbUser({ id: 'editor-id' });
    prismaMock.user.findUnique.mockResolvedValueOnce(self);

    await expect(
      updateUser('editor-id', { role: Role.ADMIN }, editorSession),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when non-admin tries to change isActive', async () => {
    const editorSession = makeSession(Role.EDITOR, 'editor-id');
    const self = makeDbUser({ id: 'editor-id' });
    prismaMock.user.findUnique.mockResolvedValueOnce(self);

    await expect(
      updateUser('editor-id', { isActive: false }, editorSession),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when ADMIN tries to deactivate themselves', async () => {
    const adminSession = makeSession(Role.ADMIN, 'admin-id');
    const self = makeDbUser({ id: 'admin-id', role: Role.ADMIN });
    prismaMock.user.findUnique.mockResolvedValueOnce(self);

    await expect(
      updateUser('admin-id', { isActive: false }, adminSession),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws NotFoundError when the target user does not exist', async () => {
    const adminSession = makeSession(Role.ADMIN);
    prismaMock.user.findUnique.mockResolvedValueOnce(null);

    await expect(
      updateUser('ghost-id', { name: 'Ghost' }, adminSession),
    ).rejects.toThrow(NotFoundError);
  });
});

// ─── deactivateUser ───────────────────────────────────────────────────────────

describe('deactivateUser', () => {
  it('throws ForbiddenError when called by EDITOR', async () => {
    const editorSession = makeSession(Role.EDITOR);
    await expect(deactivateUser('target-id', editorSession)).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when called by VIEWER', async () => {
    const viewerSession = makeSession(Role.VIEWER);
    await expect(deactivateUser('target-id', viewerSession)).rejects.toThrow(ForbiddenError);
  });

  it('throws ForbiddenError when ADMIN tries to deactivate themselves', async () => {
    const adminSession = makeSession(Role.ADMIN, 'admin-id');
    await expect(deactivateUser('admin-id', adminSession)).rejects.toThrow(ForbiddenError);
  });

  it('throws NotFoundError when target user does not exist', async () => {
    const adminSession = makeSession(Role.ADMIN, 'admin-id');
    prismaMock.user.findUnique.mockResolvedValueOnce(null);

    await expect(deactivateUser('ghost-id', adminSession)).rejects.toThrow(NotFoundError);
  });

  it('sets isActive to false on the target user', async () => {
    const adminSession = makeSession(Role.ADMIN, 'admin-id');
    const target = makeDbUser({ id: 'target-id' });
    prismaMock.user.findUnique.mockResolvedValueOnce(target);
    prismaMock.user.update.mockResolvedValueOnce({ ...target, isActive: false });

    await deactivateUser('target-id', adminSession);

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'target-id' },
        data: expect.objectContaining({ isActive: false }),
      }),
    );
  });

  it('does not hard-delete the user record', async () => {
    const adminSession = makeSession(Role.ADMIN, 'admin-id');
    const target = makeDbUser({ id: 'target-id' });
    prismaMock.user.findUnique.mockResolvedValueOnce(target);
    prismaMock.user.update.mockResolvedValueOnce({ ...target, isActive: false });

    await deactivateUser('target-id', adminSession);

    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });
});
