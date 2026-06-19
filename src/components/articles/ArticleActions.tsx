'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';

type ArticleActionsProps = {
  slug: string;
  canEdit: boolean;
  canDelete: boolean;
  onDelete: () => Promise<void>;
};

export function ArticleActions({
  slug,
  canEdit,
  canDelete,
  onDelete,
}: ArticleActionsProps): JSX.Element | null {
  if (!canEdit && !canDelete) return null;

  return (
    <div className="flex items-center gap-2">
      {canEdit ? (
        <Link href={`/articles/${slug}/edit`} data-testid="article-edit-button">
          <Button variant="secondary" size="sm">Edit</Button>
        </Link>
      ) : null}
      {canEdit ? (
        <Link href={`/articles/${slug}/history`} data-testid="article-history-button">
          <Button variant="ghost" size="sm">History</Button>
        </Link>
      ) : null}
      {canDelete ? (
        <Button
          variant="danger"
          size="sm"
          onClick={() => { void onDelete(); }}
          data-testid="article-delete-button"
        >
          Delete
        </Button>
      ) : null}
    </div>
  );
}
