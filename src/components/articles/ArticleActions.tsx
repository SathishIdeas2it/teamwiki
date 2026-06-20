'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

type ArticleActionsProps = {
  slug: string;
  canEdit: boolean;
  canDelete: boolean;
};

export function ArticleActions({
  slug,
  canEdit,
  canDelete,
}: ArticleActionsProps): JSX.Element | null {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  if (!canEdit && !canDelete) return null;

  async function handleDelete(): Promise<void> {
    if (!confirm('Delete this article? This cannot be undone.')) return;
    setIsDeleting(true);
    await fetch(`/api/articles/${slug}`, { method: 'DELETE' });
    router.push('/articles');
    router.refresh();
  }

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
          isLoading={isDeleting}
          onClick={() => {
            void handleDelete();
          }}
          data-testid="article-delete-button"
        >
          Delete
        </Button>
      ) : null}
    </div>
  );
}
