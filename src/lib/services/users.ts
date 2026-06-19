import type { AppSession, UserSummary, PaginatedResult } from '@/types';
import type { CreateUserInput, UpdateUserInput, UserListQuery } from '@/lib/validations/user';

export async function registerUser(data: CreateUserInput): Promise<UserSummary> {
  throw new Error('Not implemented');
}

export async function findUserById(
  id: string,
  session: AppSession,
): Promise<UserSummary> {
  throw new Error('Not implemented');
}

export async function listUsers(
  query: UserListQuery,
  session: AppSession,
): Promise<PaginatedResult<UserSummary>> {
  throw new Error('Not implemented');
}

export async function updateUser(
  id: string,
  data: UpdateUserInput,
  session: AppSession,
): Promise<UserSummary> {
  throw new Error('Not implemented');
}

export async function deactivateUser(id: string, session: AppSession): Promise<void> {
  throw new Error('Not implemented');
}
