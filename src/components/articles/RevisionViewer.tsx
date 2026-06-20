'use client';

import { useState, useEffect } from 'react';
import type { RevisionSummary, RevisionDetail } from '@/types';
import { RevisionList } from '@/components/articles/RevisionList';
import { DiffViewer } from '@/components/diff/DiffViewer';

type RevisionViewerProps = {
  revisions: RevisionSummary[];
};

export function RevisionViewer({ revisions }: RevisionViewerProps): JSX.Element {
  const [selectedIds, setSelectedIds] = useState<[string | null, string | null]>([null, null]);
  const [baseRevision, setBaseRevision] = useState<RevisionDetail | null>(null);
  const [headRevision, setHeadRevision] = useState<RevisionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function handleSelect(id: string): void {
    setSelectedIds(([slot1, slot2]) => {
      if (slot1 === id) return [slot2, null];
      if (slot2 === id) return [slot1, null];
      if (!slot1) return [id, slot2];
      if (!slot2) return [slot1, id];
      return [id, null];
    });
  }

  useEffect(() => {
    const [id1, id2] = selectedIds;
    if (!id1 || !id2) {
      setBaseRevision(null);
      setHeadRevision(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    Promise.all([
      fetch(`/api/revisions/${id1}`).then((r) => r.json() as Promise<RevisionDetail>),
      fetch(`/api/revisions/${id2}`).then((r) => r.json() as Promise<RevisionDetail>),
    ])
      .then(([detail1, detail2]) => {
        if (cancelled) return;
        const [base, head] =
          detail1.revisionNumber <= detail2.revisionNumber
            ? [detail1, detail2]
            : [detail2, detail1];
        setBaseRevision(base);
        setHeadRevision(head);
      })
      .catch(() => {
        if (!cancelled) {
          setBaseRevision(null);
          setHeadRevision(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedIds]);

  return (
    <div data-testid="revision-viewer">
      <RevisionList revisions={revisions} selectedIds={selectedIds} onSelect={handleSelect} />
      <div className="mt-6">
        {isLoading ? (
          <div
            className="flex items-center justify-center py-12 text-sm text-gray-500 dark:text-gray-400"
            data-testid="revision-viewer-loading"
          >
            Loading diff…
          </div>
        ) : baseRevision !== null && headRevision !== null ? (
          <DiffViewer baseRevision={baseRevision} headRevision={headRevision} />
        ) : (
          <p
            className="flex items-center justify-center py-12 text-sm text-gray-500 dark:text-gray-400"
            data-testid="revision-viewer-placeholder"
          >
            Select two revisions to compare
          </p>
        )}
      </div>
    </div>
  );
}
