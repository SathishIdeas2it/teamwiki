import type { RevisionSummary } from '@/types';

type RevisionRowProps = {
  revision: RevisionSummary;
  isSelected: boolean;
  onSelect: () => void;
};

export function RevisionRow({ revision, isSelected, onSelect }: RevisionRowProps): JSX.Element {
  return (
    <div
      className={[
        'flex items-center justify-between px-4 py-3 transition-colors',
        isSelected
          ? 'bg-brand-50 dark:bg-brand-900/20'
          : 'bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800',
      ].join(' ')}
    >
      <div>
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          #{revision.revisionNumber}
        </span>
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
          by {revision.authorName}
        </span>
        {revision.changeSummary ? (
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
            — {revision.changeSummary}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {new Date(revision.createdAt).toLocaleString()}
        </span>
        <button
          onClick={onSelect}
          className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
          data-testid={`select-revision-${revision.revisionNumber}`}
        >
          {isSelected ? 'Deselect' : 'Select'}
        </button>
      </div>
    </div>
  );
}
