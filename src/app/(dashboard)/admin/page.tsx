import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Admin Dashboard' };

export default function AdminDashboardPage(): JSX.Element {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Admin Dashboard
      </h1>
      {/* StatsCards component goes here */}
    </div>
  );
}
