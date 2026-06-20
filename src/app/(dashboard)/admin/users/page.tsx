import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { listUsers } from '@/lib/services/users';
import { hasPermission } from '@/lib/auth/permissions';
import { UserTable } from '@/components/admin/UserTable';
import type { AppSession } from '@/types';

export const metadata: Metadata = { title: 'User Management' };

export default async function UserListPage(): Promise<JSX.Element> {
  const session = (await auth()) as AppSession | null;
  if (!session) redirect('/login');
  if (!hasPermission(session.user.role, 'admin:access')) redirect('/articles');

  const result = await listUsers({ page: 1, limit: 50 }, session);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        User Management
      </h1>
      <UserTable users={result.data} currentUserId={session.user.id} />
    </div>
  );
}
