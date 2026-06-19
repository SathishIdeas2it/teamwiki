import { prismaMock } from '../../setup';
import { verifyCredentials } from '@/lib/auth/credentials';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import bcryptjs from 'bcryptjs';
const bcryptCompare = bcryptjs.compare as jest.Mock;

const ACTIVE_USER = {
  id: 'user-uuid-1',
  email: 'alice@example.com',
  name: 'Alice',
  role: 'EDITOR' as const,
  isActive: true,
  passwordHash: '$2a$12$hashedpassword',
  deletedAt: null,
};

describe('verifyCredentials', () => {
  describe('returns null for invalid inputs', () => {
    it('returns null when email is empty', async () => {
      const result = await verifyCredentials('', 'password123');
      expect(result).toBeNull();
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('returns null when password is empty', async () => {
      const result = await verifyCredentials('alice@example.com', '');
      expect(result).toBeNull();
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });

    it('returns null when user does not exist in the database', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      const result = await verifyCredentials('nobody@example.com', 'password123');
      expect(result).toBeNull();
    });

    it('returns null when user account is inactive', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({ ...ACTIVE_USER, isActive: false });
      const result = await verifyCredentials('alice@example.com', 'password123');
      expect(result).toBeNull();
    });

    it('returns null when user has no password hash (OAuth-only account)', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({ ...ACTIVE_USER, passwordHash: null });
      const result = await verifyCredentials('alice@example.com', 'password123');
      expect(result).toBeNull();
      expect(bcryptCompare).not.toHaveBeenCalled();
    });

    it('returns null when user is soft-deleted', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        ...ACTIVE_USER,
        deletedAt: new Date(),
      });
      const result = await verifyCredentials('alice@example.com', 'password123');
      expect(result).toBeNull();
    });

    it('returns null when bcrypt compare fails (wrong password)', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(ACTIVE_USER);
      bcryptCompare.mockResolvedValueOnce(false);
      const result = await verifyCredentials('alice@example.com', 'wrongpassword');
      expect(result).toBeNull();
    });
  });

  describe('returns user on success', () => {
    it('returns user object when credentials are correct', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(ACTIVE_USER);
      bcryptCompare.mockResolvedValueOnce(true);

      const result = await verifyCredentials('alice@example.com', 'correctpassword');

      expect(result).toEqual({
        id: ACTIVE_USER.id,
        email: ACTIVE_USER.email,
        name: ACTIVE_USER.name,
        role: ACTIVE_USER.role,
      });
    });

    it('does not include the password hash in the returned object', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(ACTIVE_USER);
      bcryptCompare.mockResolvedValueOnce(true);

      const result = await verifyCredentials('alice@example.com', 'password123');

      expect(result).not.toHaveProperty('passwordHash');
    });

    it('queries the database with the correct email', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(ACTIVE_USER);
      bcryptCompare.mockResolvedValueOnce(true);

      await verifyCredentials('alice@example.com', 'password123');

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ email: 'alice@example.com' }),
        }),
      );
    });

    it('passes the plain-text password and stored hash to bcrypt.compare', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(ACTIVE_USER);
      bcryptCompare.mockResolvedValueOnce(true);

      await verifyCredentials('alice@example.com', 'myplainpassword');

      expect(bcryptCompare).toHaveBeenCalledWith('myplainpassword', ACTIVE_USER.passwordHash);
    });

    it.each(['VIEWER', 'EDITOR', 'ADMIN'] as const)(
      'returns the correct role for %s users',
      async (role) => {
        prismaMock.user.findUnique.mockResolvedValueOnce({ ...ACTIVE_USER, role });
        bcryptCompare.mockResolvedValueOnce(true);

        const result = await verifyCredentials('alice@example.com', 'password');
        expect(result?.role).toBe(role);
      },
    );
  });
});
