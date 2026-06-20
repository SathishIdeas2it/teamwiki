import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/config';
import { findUserById } from '@/lib/services/users';
import { hasPermission } from '@/lib/auth/permissions';
import { NotFoundError } from '@/lib/errors';
import { UserEditForm } from '@/components/admin/UserEditForm';
import type { AppSession } from '@/types';

type UserDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: UserDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  void id;
  return { title: 'Edit User' };
}

export default async function UserDetailPage({ params }: UserDetailPageProps): Promise<JSX.Element> {
  const session = (await auth()) as AppSession | null;
  if (!session) redirect('/login');
  if (!hasPermission(session.user.role, 'admin:access')) redirect('/articles');

  const { id } = await params;

  let user;
  try {
    user = await findUserById(id, session);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/users"
          className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          ← Back to users
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">Edit User</h1>
      </div>
      <UserEditForm user={user} />
    </div>
  );
}
