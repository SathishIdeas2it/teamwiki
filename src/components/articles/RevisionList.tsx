import type { RevisionSummary } from '@/types';
import { RevisionRow } from '@/components/articles/RevisionRow';

type RevisionListProps = {
  revisions: RevisionSummary[];
  selectedIds: [string | null, string | null];
  onSelect: (id: string) => void;
};

export function RevisionList({
  revisions,
  selectedIds,
  onSelect,
}: RevisionListProps): JSX.Element {
  return (
    <div className="divide-y rounded-lg border dark:divide-gray-800 dark:border-gray-800">
      {revisions.map((revision) => (
        <RevisionRow
          key={revision.id}
          revision={revision}
          isSelected={selectedIds.includes(revision.id)}
          onSelect={() => onSelect(revision.id)}
        />
      ))}
    </div>
  );
}
