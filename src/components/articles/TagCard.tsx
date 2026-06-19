import Link from 'next/link';
import type { TagWithCategory } from '@/types';

type TagCardProps = {
  tag: TagWithCategory;
};

export function TagCard({ tag }: TagCardProps): JSX.Element {
  return (
    <Link
      href={`/tags/${tag.slug}`}
      className="rounded-lg border bg-white p-4 shadow-card transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
      data-testid={`tag-card-${tag.slug}`}
    >
      <p className="font-medium text-gray-900 dark:text-gray-100">{tag.name}</p>
      {tag.category ? (
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{tag.category.name}</p>
      ) : null}
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {tag.articleCount} article{tag.articleCount !== 1 ? 's' : ''}
      </p>
    </Link>
  );
}
