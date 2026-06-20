import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { NavLinks } from '@/components/layout/NavLinks';
import { SearchBar } from '@/components/search/SearchBar';
import type { AppSession } from '@/types';

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps): Promise<JSX.Element> {
  const session = (await auth()) as AppSession | null;
  if (!session) redirect('/login');

  const isAdmin = session.user.role === 'ADMIN';

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-sidebar flex-col border-r bg-white dark:bg-gray-900">
        <div className="flex h-topbar flex-shrink-0 items-center border-b px-6">
          <Link
            href="/articles"
            className="text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            TeamWiki
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto p-4" aria-label="Main navigation">
          <NavLinks isAdmin={isAdmin} />
        </nav>

        <div className="flex-shrink-0 border-t p-4">
          <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-300">
            {session.user.name}
          </p>
          <p className="text-xs capitalize text-gray-500 dark:text-gray-400">
            {session.user.role.toLowerCase()}
          </p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col pl-sidebar">
        <header className="sticky top-0 z-30 flex h-topbar items-center gap-4 border-b bg-white px-6 dark:bg-gray-900">
          <SearchBar placeholder="Search articles…" />
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
