import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { auth } from '@/lib/auth/config';
import { getArticleBySlug } from '@/lib/services/articles';
import { canEditArticle, hasPermission } from '@/lib/auth/permissions';
import { NotFoundError } from '@/lib/errors';
import { ArticleMetadata } from '@/components/articles/ArticleMetadata';
import { ArticleActions } from '@/components/articles/ArticleActions';
import { TagBadge } from '@/components/articles/TagBadge';
import { MarkdownPreview } from '@/components/articles/MarkdownPreview';
import type { AppSession } from '@/types';

type ArticleViewPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ArticleViewPageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug };
}

function ArticleContentSkeleton(): JSX.Element {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-10 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
      <div className="h-4 w-1/4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
      <div className="h-64 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
    </div>
  );
}

export default async function ArticleViewPage({ params }: ArticleViewPageProps): Promise<JSX.Element> {
  const session = (await auth()) as AppSession | null;
  if (!session) redirect('/login');

  const { slug } = await params;

  let article;
  try {
    article = await getArticleBySlug(slug, session);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const canEdit = canEditArticle(session, { authorId: article.author.id });
  const canDelete = hasPermission(session.user.role, 'article:delete');

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{article.title}</h1>
          <div className="mt-2">
            <ArticleMetadata article={article} />
          </div>
        </div>
        <ArticleActions slug={slug} canEdit={canEdit} canDelete={canDelete} />
      </div>

      {article.tags.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <TagBadge key={tag.id} tag={tag} />
          ))}
        </div>
      ) : null}

      <Suspense fallback={<ArticleContentSkeleton />}>
        <MarkdownPreview content={article.content} />
      </Suspense>
    </div>
  );
}
