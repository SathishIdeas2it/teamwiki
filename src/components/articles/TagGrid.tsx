import type { TagWithCategory } from '@/types';
import { TagCard } from '@/components/articles/TagCard';

type TagGridProps = {
  tags: TagWithCategory[];
};

export function TagGrid({ tags }: TagGridProps): JSX.Element {
  if (tags.length === 0) {
    return (
      <p className="text-gray-500 dark:text-gray-400">No tags yet.</p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {tags.map((tag) => (
        <TagCard key={tag.id} tag={tag} />
      ))}
    </div>
  );
}
