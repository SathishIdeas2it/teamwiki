'use client';

type DiffOutputProps = {
  patch: string;
  mode: 'unified' | 'split';
};

type ParsedLine = {
  type: 'add' | 'remove' | 'context' | 'header';
  content: string;
};

function parseUnifiedDiff(patch: string): ParsedLine[] {
  return patch.split('\n').map((line) => {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@') || line.startsWith('diff')) {
      return { type: 'header', content: line };
    }
    if (line.startsWith('+')) return { type: 'add', content: line.slice(1) };
    if (line.startsWith('-')) return { type: 'remove', content: line.slice(1) };
    return { type: 'context', content: line.startsWith(' ') ? line.slice(1) : line };
  });
}

const lineClasses: Record<ParsedLine['type'], string> = {
  add: 'bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-200',
  remove: 'bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-200',
  context: 'text-gray-800 dark:text-gray-200',
  header: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 font-mono text-xs',
};

export function DiffOutput({ patch, mode }: DiffOutputProps): JSX.Element {
  const lines = parseUnifiedDiff(patch);
  void mode;

  return (
    <div
      className="overflow-auto rounded-lg border font-mono text-sm dark:border-gray-700"
      data-testid="diff-output"
    >
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, idx) => (
            <tr key={idx} className={lineClasses[line.type]}>
              <td className="select-none border-r px-2 py-0.5 text-right text-xs opacity-40 dark:border-gray-700">
                {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
              </td>
              <td className="px-4 py-0.5 whitespace-pre">{line.content || ' '}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
