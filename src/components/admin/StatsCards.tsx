import type { DashboardStats } from '@/types';

type StatsCardsProps = {
  stats: DashboardStats;
};

type StatCardProps = {
  label: string;
  value: number | string;
};

function StatCard({ label, value }: StatCardProps): JSX.Element {
  return (
    <div className="rounded-lg border bg-white p-5 shadow-card dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

export function StatsCards({ stats }: StatsCardsProps): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <StatCard label="Total Articles" value={stats.totalArticles} />
      <StatCard label="Published" value={stats.publishedArticles} />
      <StatCard label="Drafts" value={stats.draftArticles} />
      <StatCard label="Total Users" value={stats.totalUsers} />
      <StatCard label="This Month" value={stats.articlesThisMonth} />
      <StatCard label="Recent Imports" value={stats.recentImports} />
    </div>
  );
}
