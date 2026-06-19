import type { ReactNode } from 'react';

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps): JSX.Element {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar placeholder */}
      <aside className="fixed inset-y-0 left-0 z-40 w-sidebar border-r bg-white dark:bg-gray-900">
        <div className="flex h-topbar items-center border-b px-6">
          <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            TeamWiki
          </span>
        </div>
        <nav className="p-4" aria-label="Main navigation">
          {/* NavLinks component goes here */}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col pl-sidebar">
        {/* TopBar placeholder */}
        <header className="sticky top-0 z-30 flex h-topbar items-center border-b bg-white px-6 dark:bg-gray-900">
          <div className="flex flex-1 items-center gap-4">
            {/* SearchInput component goes here */}
          </div>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
