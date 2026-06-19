import Link from 'next/link';
import type { TagSummary } from '@/types';

type TagBadgeProps = {
  tag: TagSummary;
  asLink?: boolean;
};

export function TagBadge({ tag, asLink = true }: TagBadgeProps): JSX.Element {
  const classes =
    'inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300';

  if (asLink) {
    return (
      <Link href={`/tags/${tag.slug}`} className={`${classes} hover:bg-brand-100 dark:hover:bg-brand-900/50`}>
        {tag.name}
      </Link>
    );
  }

  return <span className={classes}>{tag.name}</span>;
}
