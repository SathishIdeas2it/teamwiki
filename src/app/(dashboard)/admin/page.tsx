import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { getDashboardStats } from '@/lib/services/admin';
import { hasPermission } from '@/lib/auth/permissions';
import { StatsCards } from '@/components/admin/StatsCards';
import type { AppSession } from '@/types';

export const metadata: Metadata = { title: 'Admin Dashboard' };

export default async function AdminDashboardPage(): Promise<JSX.Element> {
  const session = (await auth()) as AppSession | null;
  if (!session) redirect('/login');
  if (!hasPermission(session.user.role, 'admin:access')) redirect('/articles');

  const stats = await getDashboardStats(session);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Admin Dashboard
      </h1>
      <StatsCards stats={stats} />
    </div>
  );
}
