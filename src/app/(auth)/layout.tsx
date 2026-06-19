import type { ReactNode } from 'react';

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">TeamWiki</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Internal knowledge base
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
