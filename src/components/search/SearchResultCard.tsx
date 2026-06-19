import Link from 'next/link';
import type { SearchResult } from '@/types';

type SearchResultCardProps = {
  result: SearchResult;
};

export function SearchResultCard({ result }: SearchResultCardProps): JSX.Element {
  return (
    <article
      className="rounded-lg border bg-white p-4 shadow-card dark:border-gray-800 dark:bg-gray-900"
      data-testid="search-result-card"
    >
      <Link
        href={`/articles/${result.slug}`}
        className="text-lg font-semibold text-gray-900 hover:text-brand-600 dark:text-gray-100 dark:hover:text-brand-400"
      >
        {result.title}
      </Link>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {result.authorName} ·{' '}
        {result.publishedAt ? new Date(result.publishedAt).toLocaleDateString() : 'Draft'}
      </p>
      {result.excerpt ? (
        <p
          className="mt-2 text-sm text-gray-600 dark:text-gray-300 [&_mark]:bg-yellow-100 [&_mark]:dark:bg-yellow-900/40"
          dangerouslySetInnerHTML={{ __html: result.excerpt }}
        />
      ) : null}
    </article>
  );
}
