import * as Diff from 'diff';

export type DiffLineType = 'add' | 'remove' | 'context' | 'header';

export type ParsedLine = {
  type: DiffLineType;
  content: string;
};

export type SplitLine = {
  left: ParsedLine | null;
  right: ParsedLine | null;
};

export function computeDiff(
  title: string,
  baseContent: string,
  headContent: string,
  baseLabel: string,
  headLabel: string,
): string {
  return Diff.createPatch(title, baseContent, headContent, baseLabel, headLabel);
}

export function parseUnifiedDiff(patch: string): ParsedLine[] {
  return patch.split('\n').map((line): ParsedLine => {
    if (
      line.startsWith('---') ||
      line.startsWith('+++') ||
      line.startsWith('@@') ||
      line.startsWith('diff ') ||
      line.startsWith('Index:') ||
      line.startsWith('===')
    ) {
      return { type: 'header', content: line };
    }
    if (line.startsWith('+')) return { type: 'add', content: line.slice(1) };
    if (line.startsWith('-')) return { type: 'remove', content: line.slice(1) };
    return { type: 'context', content: line.startsWith(' ') ? line.slice(1) : line };
  });
}

export function toSplitLines(lines: ParsedLine[]): SplitLine[] {
  const result: SplitLine[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) { i++; continue; }

    if (line.type === 'header') {
      result.push({ left: line, right: null });
      i++;
      continue;
    }

    if (line.type === 'context') {
      result.push({ left: line, right: line });
      i++;
      continue;
    }

    // Change block: collect all consecutive removes, then all consecutive adds.
    // In a valid unified diff, removes always precede adds within a hunk.
    const removes: ParsedLine[] = [];
    const adds: ParsedLine[] = [];

    while (i < lines.length && lines[i]?.type === 'remove') {
      removes.push(lines[i]!);
      i++;
    }
    while (i < lines.length && lines[i]?.type === 'add') {
      adds.push(lines[i]!);
      i++;
    }

    const maxLen = Math.max(removes.length, adds.length);
    for (let j = 0; j < maxLen; j++) {
      result.push({
        left: removes[j] ?? null,
        right: adds[j] ?? null,
      });
    }
  }

  return result;
}
