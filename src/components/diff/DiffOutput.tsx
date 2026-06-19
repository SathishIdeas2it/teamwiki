'use client';

import { parseUnifiedDiff, toSplitLines } from '@/lib/utils/diff';
import type { DiffLineType, ParsedLine } from '@/lib/utils/diff';

export type DiffOutputProps = {
  patch: string;
  mode: 'unified' | 'split';
};

const rowClasses: Record<DiffLineType, string> = {
  add: 'bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-200',
  remove: 'bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-200',
  context: 'text-gray-800 dark:text-gray-200',
  header: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

function marker(type: DiffLineType): string {
  if (type === 'add') return '+';
  if (type === 'remove') return '-';
  return ' ';
}

function UnifiedView({ lines }: { lines: ParsedLine[] }): JSX.Element {
  return (
    <table className="w-full border-collapse">
      <tbody>
        {lines.map((line, idx) => (
          <tr
            key={idx}
            className={rowClasses[line.type]}
            data-testid={`diff-line-${line.type}`}
          >
            <td className="w-8 select-none border-r px-2 py-0.5 text-right text-xs opacity-40 dark:border-gray-700">
              {marker(line.type)}
            </td>
            <td className="px-4 py-0.5 whitespace-pre font-mono">{line.content || ' '}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SplitView({ patch }: { patch: string }): JSX.Element {
  const splitLines = toSplitLines(parseUnifiedDiff(patch));

  return (
    <table className="w-full border-collapse">
      <colgroup>
        <col className="w-8" />
        <col className="w-1/2" />
        <col className="w-8" />
        <col className="w-1/2" />
      </colgroup>
      <tbody>
        {splitLines.map((row, idx) => {
          if (row.left?.type === 'header') {
            return (
              <tr
                key={idx}
                className={rowClasses.header}
                data-testid="diff-line-header"
              >
                <td colSpan={4} className="px-4 py-0.5 font-mono text-xs">
                  {row.left.content}
                </td>
              </tr>
            );
          }

          const leftCls = row.left ? rowClasses[row.left.type] : '';
          const rightCls = row.right ? rowClasses[row.right.type] : '';

          return (
            <tr key={idx}>
              <td
                className={`w-8 select-none border-r px-2 py-0.5 text-right text-xs opacity-40 dark:border-gray-700 ${leftCls}`}
              >
                {row.left ? marker(row.left.type) : ''}
              </td>
              <td
                className={`border-r px-4 py-0.5 whitespace-pre font-mono dark:border-gray-700 ${leftCls}`}
                data-testid="diff-split-left"
              >
                {row.left?.content ?? ''}
              </td>
              <td
                className={`w-8 select-none border-r px-2 py-0.5 text-right text-xs opacity-40 dark:border-gray-700 ${rightCls}`}
              >
                {row.right ? marker(row.right.type) : ''}
              </td>
              <td
                className={`px-4 py-0.5 whitespace-pre font-mono ${rightCls}`}
                data-testid="diff-split-right"
              >
                {row.right?.content ?? ''}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function DiffOutput({ patch, mode }: DiffOutputProps): JSX.Element {
  const lines = parseUnifiedDiff(patch);

  return (
    <div
      className="overflow-auto rounded-lg border font-mono text-sm dark:border-gray-700"
      data-testid="diff-output"
    >
      {mode === 'split' ? <SplitView patch={patch} /> : <UnifiedView lines={lines} />}
    </div>
  );
}
