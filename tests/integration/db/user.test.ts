import { Role } from '@prisma/client';
import { prisma, createTestUser } from '../helpers/db';

describe('User model', () => {
  describe('create', () => {
    it('generates a UUID primary key', async () => {
      const user = await createTestUser({ email: 'uuid-test@example.com' });
      expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('defaults role to VIEWER', async () => {
      const user = await prisma.user.create({
        data: { email: 'default-role@example.com', name: 'Default Role' },
        select: { role: true },
      });
      expect(user.role).toBe(Role.VIEWER);
    });

    it('defaults isActive to true', async () => {
      const user = await prisma.user.create({
        data: { email: 'default-active@example.com', name: 'Default Active' },
        select: { isActive: true },
      });
      expect(user.isActive).toBe(true);
    });

    it('populates createdAt and updatedAt on creation', async () => {
      const user = await prisma.user.create({
        data: { email: 'timestamps@example.com', name: 'Timestamps' },
        select: { createdAt: true, updatedAt: true },
      });
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('defaults deletedAt to null', async () => {
      const user = await prisma.user.create({
        data: { email: 'not-deleted@example.com', name: 'Not Deleted' },
        select: { deletedAt: true },
      });
      expect(user.deletedAt).toBeNull();
    });

    it('allows optional passwordHash', async () => {
      const user = await prisma.user.create({
        data: { email: 'no-password@example.com', name: 'No Password' },
        select: { passwordHash: true },
      });
      expect(user.passwordHash).toBeNull();
    });

    it('enforces unique email', async () => {
      await createTestUser({ email: 'dup@example.com' });
      await expect(createTestUser({ email: 'dup@example.com' })).rejects.toThrow();
    });
  });

  describe('soft delete', () => {
    it('sets deletedAt when soft-deleting a user', async () => {
      const user = await createTestUser({ email: 'soft-del@example.com' });
      const deletedAt = new Date();

      await prisma.user.update({
        where: { id: user.id },
        data: { deletedAt },
      });

      const found = await prisma.user.findUnique({
        where: { id: user.id },
        select: { deletedAt: true },
      });
      expect(found?.deletedAt).toBeInstanceOf(Date);
    });

    it('soft-deleted user remains in the database', async () => {
      const user = await createTestUser({ email: 'ghost@example.com' });
      await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });

      const count = await prisma.user.count({ where: { id: user.id } });
      expect(count).toBe(1);
    });

    it('active-user filter (deletedAt: null) excludes soft-deleted users', async () => {
      const user = await createTestUser({ email: 'excluded@example.com' });
      await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });

      const count = await prisma.user.count({ where: { id: user.id, deletedAt: null } });
      expect(count).toBe(0);
    });

    it('active-user filter includes non-deleted users', async () => {
      const user = await createTestUser({ email: 'included@example.com' });

      const count = await prisma.user.count({ where: { id: user.id, deletedAt: null } });
      expect(count).toBe(1);
    });

    it('can restore a soft-deleted user by setting deletedAt to null', async () => {
      const user = await createTestUser({ email: 'restore@example.com' });
      await prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } });
      await prisma.user.update({ where: { id: user.id }, data: { deletedAt: null } });

      const found = await prisma.user.findUnique({
        where: { id: user.id },
        select: { deletedAt: true },
      });
      expect(found?.deletedAt).toBeNull();
    });
  });

  describe('roles', () => {
    it.each([Role.VIEWER, Role.EDITOR, Role.ADMIN, Role.SYSTEM])(
      'stores role %s correctly',
      async (role) => {
        const user = await prisma.user.create({
          data: { email: `role-${role.toLowerCase()}@example.com`, name: role, role },
          select: { role: true },
        });
        expect(user.role).toBe(role);
      },
    );
  });

  describe('updatedAt', () => {
    it('advances updatedAt when a field is modified', async () => {
      const user = await prisma.user.create({
        data: { email: 'update-ts@example.com', name: 'Original Name' },
        select: { id: true, updatedAt: true },
      });
      const originalUpdatedAt = user.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 50));

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { name: 'Updated Name' },
        select: { updatedAt: true },
      });

      expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});
