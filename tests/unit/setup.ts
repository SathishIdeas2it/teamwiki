import { mockDeep, mockReset } from 'jest-mock-extended';
import type { PrismaClient } from '@prisma/client';

export const prismaMock = mockDeep<PrismaClient>();

jest.mock('@/lib/db/client', () => ({
  db: prismaMock,
}));

beforeEach(() => {
  mockReset(prismaMock);
});
