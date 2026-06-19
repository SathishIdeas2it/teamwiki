import { parseUnifiedDiff, toSplitLines, computeDiff } from '@/lib/utils/diff';

// ─── parseUnifiedDiff ─────────────────────────────────────────────────────────

describe('parseUnifiedDiff', () => {
  it('classifies lines starting with + as add', () => {
    const [line] = parseUnifiedDiff('+added content');
    expect(line?.type).toBe('add');
  });

  it('strips the leading + sigil from add line content', () => {
    const [line] = parseUnifiedDiff('+hello world');
    expect(line?.content).toBe('hello world');
  });

  it('classifies lines starting with - as remove', () => {
    const [line] = parseUnifiedDiff('-removed content');
    expect(line?.type).toBe('remove');
  });

  it('strips the leading - sigil from remove line content', () => {
    const [line] = parseUnifiedDiff('-goodbye');
    expect(line?.content).toBe('goodbye');
  });

  it('classifies lines starting with a space as context and strips the leading space', () => {
    const [line] = parseUnifiedDiff(' context line');
    expect(line).toEqual({ type: 'context', content: 'context line' });
  });

  it('classifies --- lines as header and preserves content', () => {
    const [line] = parseUnifiedDiff('--- a/file');
    expect(line?.type).toBe('header');
    expect(line?.content).toBe('--- a/file');
  });

  it('classifies +++ lines as header', () => {
    const [line] = parseUnifiedDiff('+++ b/file');
    expect(line?.type).toBe('header');
  });

  it('classifies @@ hunk markers as header', () => {
    const [line] = parseUnifiedDiff('@@ -1,3 +1,3 @@');
    expect(line?.type).toBe('header');
  });

  it('classifies lines starting with "diff " as header', () => {
    const [line] = parseUnifiedDiff('diff --git a b');
    expect(line?.type).toBe('header');
  });

  it('classifies lines starting with "Index:" as header', () => {
    const [line] = parseUnifiedDiff('Index: filename');
    expect(line?.type).toBe('header');
  });

  it('classifies === separator lines as header', () => {
    const [line] = parseUnifiedDiff('===================================================================');
    expect(line?.type).toBe('header');
  });

  it('handles a multi-line patch and returns one entry per line', () => {
    const patch = '+added\n-removed\n context';
    const lines = parseUnifiedDiff(patch);
    expect(lines).toHaveLength(3);
    expect(lines[0]?.type).toBe('add');
    expect(lines[1]?.type).toBe('remove');
    expect(lines[2]?.type).toBe('context');
  });

  it('treats an empty string as a single context line with empty content', () => {
    const lines = parseUnifiedDiff('');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({ type: 'context', content: '' });
  });
});

// ─── toSplitLines ─────────────────────────────────────────────────────────────

describe('toSplitLines', () => {
  it('returns an empty array for empty input', () => {
    expect(toSplitLines([])).toHaveLength(0);
  });

  it('places context lines on both left and right', () => {
    const ctx = { type: 'context' as const, content: 'same line' };
    const [row] = toSplitLines([ctx]);
    expect(row).toEqual({ left: ctx, right: ctx });
  });

  it('places header lines on left only (right is null)', () => {
    const header = { type: 'header' as const, content: '@@ -1 +1 @@' };
    const [row] = toSplitLines([header]);
    expect(row?.left).toEqual(header);
    expect(row?.right).toBeNull();
  });

  it('places a standalone remove line on left with null right', () => {
    const remove = { type: 'remove' as const, content: 'old line' };
    const [row] = toSplitLines([remove]);
    expect(row).toEqual({ left: remove, right: null });
  });

  it('places a standalone add line on right with null left', () => {
    const add = { type: 'add' as const, content: 'new line' };
    const [row] = toSplitLines([add]);
    expect(row).toEqual({ left: null, right: add });
  });

  it('pairs one remove with one add in the same row', () => {
    const remove = { type: 'remove' as const, content: 'old' };
    const add = { type: 'add' as const, content: 'new' };
    const split = toSplitLines([remove, add]);
    expect(split).toHaveLength(1);
    expect(split[0]).toEqual({ left: remove, right: add });
  });

  it('handles more removes than adds — extra removes get null right', () => {
    const lines = [
      { type: 'remove' as const, content: 'old1' },
      { type: 'remove' as const, content: 'old2' },
      { type: 'add' as const, content: 'new1' },
    ];
    const split = toSplitLines(lines);
    expect(split).toHaveLength(2);
    expect(split[0]).toEqual({ left: lines[0], right: lines[2] });
    expect(split[1]).toEqual({ left: lines[1], right: null });
  });

  it('handles more adds than removes — extra adds get null left', () => {
    const lines = [
      { type: 'remove' as const, content: 'old1' },
      { type: 'add' as const, content: 'new1' },
      { type: 'add' as const, content: 'new2' },
    ];
    const split = toSplitLines(lines);
    expect(split).toHaveLength(2);
    expect(split[0]).toEqual({ left: lines[0], right: lines[1] });
    expect(split[1]).toEqual({ left: null, right: lines[2] });
  });

  it('correctly handles multiple change blocks separated by context', () => {
    const lines = [
      { type: 'remove' as const, content: 'old' },
      { type: 'add' as const, content: 'new' },
      { type: 'context' as const, content: 'middle' },
      { type: 'remove' as const, content: 'old2' },
      { type: 'add' as const, content: 'new2' },
    ];
    const split = toSplitLines(lines);
    expect(split).toHaveLength(3);
    expect(split[0]).toEqual({ left: lines[0], right: lines[1] });
    expect(split[1]).toEqual({ left: lines[2], right: lines[2] });
    expect(split[2]).toEqual({ left: lines[3], right: lines[4] });
  });
});

// ─── computeDiff ──────────────────────────────────────────────────────────────

describe('computeDiff', () => {
  it('returns a string containing unified diff markers', () => {
    const patch = computeDiff('title', 'old line\n', 'new line\n', 'Base', 'Head');
    expect(typeof patch).toBe('string');
    expect(patch).toContain('---');
    expect(patch).toContain('+++');
    expect(patch).toContain('-old line');
    expect(patch).toContain('+new line');
  });

  it('produces no @@ hunk when both contents are identical', () => {
    const patch = computeDiff('title', 'same\n', 'same\n', 'A', 'B');
    expect(patch).not.toContain('@@');
  });
});
