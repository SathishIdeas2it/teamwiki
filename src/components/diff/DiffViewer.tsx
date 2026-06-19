'use client';

import { useState, useMemo } from 'react';
import * as Diff from 'diff';
import type { RevisionDetail } from '@/types';
import { DiffOutput } from '@/components/diff/DiffOutput';

type DiffViewerProps = {
  baseRevision: RevisionDetail;
  headRevision: RevisionDetail;
};

type DiffMode = 'unified' | 'split';

export function DiffViewer({ baseRevision, headRevision }: DiffViewerProps): JSX.Element {
  const [mode, setMode] = useState<DiffMode>('unified');

  const patch = useMemo(
    () =>
      Diff.createPatch(
        baseRevision.title,
        baseRevision.content,
        headRevision.content,
        `Revision #${baseRevision.revisionNumber}`,
        `Revision #${headRevision.revisionNumber}`,
      ),
    [baseRevision, headRevision],
  );

  return (
    <div data-testid="diff-viewer">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Comparing{' '}
          <strong>#{baseRevision.revisionNumber}</strong> → <strong>#{headRevision.revisionNumber}</strong>
        </p>
        <div className="flex rounded-md border dark:border-gray-700">
          {(['unified', 'split'] as DiffMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={[
                'px-3 py-1.5 text-xs font-medium capitalize',
                mode === m
                  ? 'bg-brand-600 text-white dark:bg-brand-500'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800',
              ].join(' ')}
              data-testid={`diff-mode-${m}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <DiffOutput patch={patch} mode={mode} />
    </div>
  );
}
