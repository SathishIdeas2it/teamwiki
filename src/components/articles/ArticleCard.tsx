import Link from 'next/link';
import type { ArticleSummary } from '@/types';
import { TagBadge } from '@/components/articles/TagBadge';

type ArticleCardProps = {
  article: ArticleSummary;
};

export function ArticleCard({ article }: ArticleCardProps): JSX.Element {
  return (
    <article className="rounded-lg border bg-white p-5 shadow-card transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      <Link href={`/articles/${article.slug}`} className="block">
        <h2 className="text-lg font-semibold text-gray-900 hover:text-brand-600 dark:text-gray-100 dark:hover:text-brand-400">
          {article.title}
        </h2>
      </Link>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {article.author.name} ·{' '}
        {article.publishedAt
          ? new Date(article.publishedAt).toLocaleDateString()
          : `Draft`}
      </p>
      {article.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {article.tags.map((tag) => (
            <TagBadge key={tag.id} tag={tag} />
          ))}
        </div>
      ) : null}
    </article>
  );
}
