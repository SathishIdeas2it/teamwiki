import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = { title: 'Articles' };

export default function ArticleListPage(): JSX.Element {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Articles</h1>
      </div>
      <Suspense fallback={<ArticleListSkeleton />}>
        {/* ArticleList component goes here */}
        <p className="text-gray-500 dark:text-gray-400">Article list coming soon.</p>
      </Suspense>
    </div>
  );
}

function ArticleListSkeleton(): JSX.Element {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton h-24 w-full rounded-lg" />
      ))}
    </div>
  );
}
