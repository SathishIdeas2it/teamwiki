import Link from 'next/link';
import type { TagWithCategory } from '@/types';

type TagSidebarProps = {
  tags: TagWithCategory[];
  selectedSlug?: string;
};

export function TagSidebar({ tags, selectedSlug }: TagSidebarProps): JSX.Element {
  return (
    <nav aria-label="Tags" data-testid="tag-sidebar">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Tags
      </h3>
      <ul className="space-y-1">
        {tags.map((tag) => {
          const isSelected = tag.slug === selectedSlug;
          return (
            <li key={tag.id}>
              <Link
                href={`/tags/${tag.slug}`}
                aria-current={isSelected ? 'page' : undefined}
                className={[
                  'flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                  isSelected
                    ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/20 dark:text-brand-300'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
                ].join(' ')}
                data-testid={`tag-sidebar-tag-${tag.slug}`}
              >
                <span>{tag.name}</span>
                <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  {tag.articleCount}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
