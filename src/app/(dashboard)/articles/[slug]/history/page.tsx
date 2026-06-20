import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth/config';
import { getArticleBySlug } from '@/lib/services/articles';
import { listByArticle } from '@/lib/services/revisions';
import { NotFoundError } from '@/lib/errors';
import { RevisionViewer } from '@/components/articles/RevisionViewer';
import type { AppSession } from '@/types';

type ArticleHistoryPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ArticleHistoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `History: ${slug}` };
}

export default async function ArticleHistoryPage({
  params,
}: ArticleHistoryPageProps): Promise<JSX.Element> {
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

  const revisions = await listByArticle(article.id, session);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <Link
          href={`/articles/${slug}`}
          className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          ← Back to article
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          Revision History
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{article.title}</p>
      </div>

      {revisions.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No revisions found.</p>
      ) : (
        <RevisionViewer revisions={revisions} />
      )}
    </div>
  );
}
