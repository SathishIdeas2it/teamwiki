import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { listArticles } from '@/lib/services/articles';
import { hasPermission } from '@/lib/auth/permissions';
import { ArticleList } from '@/components/articles/ArticleList';
import { Button } from '@/components/ui/Button';
import type { AppSession } from '@/types';

export const metadata: Metadata = { title: 'Articles' };

async function ArticlesFeed({ session }: { session: AppSession }): Promise<JSX.Element> {
  const result = await listArticles({ page: 1, limit: 20 }, session);
  return <ArticleList articles={result.data} />;
}

function ArticleListSkeleton(): JSX.Element {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading articles">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-24 w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" />
      ))}
    </div>
  );
}

export default async function ArticleListPage(): Promise<JSX.Element> {
  const session = (await auth()) as AppSession | null;
  if (!session) redirect('/login');

  const canCreate = hasPermission(session.user.role, 'article:create');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Articles</h1>
        {canCreate ? (
          <Link href="/articles/new">
            <Button data-testid="new-article-button">New Article</Button>
          </Link>
        ) : null}
      </div>
      <Suspense fallback={<ArticleListSkeleton />}>
        <ArticlesFeed session={session} />
      </Suspense>
    </div>
  );
}
