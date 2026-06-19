import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DiffOutput } from '@/components/diff/DiffOutput';

// Deterministic unified-diff patch for all tests in this file
const SAMPLE_PATCH = [
  'Index: test-article',
  '===================================================================',
  '--- test-article\tRevision #1',
  '+++ test-article\tRevision #2',
  '@@ -1,4 +1,4 @@',
  ' context line',
  '-removed line',
  '+added line',
  ' another context',
].join('\n');

// ─── Unified mode ─────────────────────────────────────────────────────────────

describe('DiffOutput — unified mode', () => {
  it('renders the diff-output container', () => {
    render(<DiffOutput patch={SAMPLE_PATCH} mode="unified" />);
    expect(screen.getByTestId('diff-output')).toBeInTheDocument();
  });

  it('renders added lines with the diff-line-add testid', () => {
    render(<DiffOutput patch={SAMPLE_PATCH} mode="unified" />);
    expect(screen.getAllByTestId('diff-line-add').length).toBeGreaterThan(0);
  });

  it('renders removed lines with the diff-line-remove testid', () => {
    render(<DiffOutput patch={SAMPLE_PATCH} mode="unified" />);
    expect(screen.getAllByTestId('diff-line-remove').length).toBeGreaterThan(0);
  });

  it('renders context lines with the diff-line-context testid', () => {
    render(<DiffOutput patch={SAMPLE_PATCH} mode="unified" />);
    expect(screen.getAllByTestId('diff-line-context').length).toBeGreaterThan(0);
  });

  it('renders header lines with the diff-line-header testid', () => {
    render(<DiffOutput patch={SAMPLE_PATCH} mode="unified" />);
    expect(screen.getAllByTestId('diff-line-header').length).toBeGreaterThan(0);
  });

  it('shows the added line text', () => {
    render(<DiffOutput patch={SAMPLE_PATCH} mode="unified" />);
    const [addRow] = screen.getAllByTestId('diff-line-add');
    expect(addRow).toHaveTextContent('added line');
  });

  it('shows the removed line text', () => {
    render(<DiffOutput patch={SAMPLE_PATCH} mode="unified" />);
    const [removeRow] = screen.getAllByTestId('diff-line-remove');
    expect(removeRow).toHaveTextContent('removed line');
  });

  it('strips the leading + sigil so the content cell does not begin with +', () => {
    render(<DiffOutput patch={SAMPLE_PATCH} mode="unified" />);
    const [addRow] = screen.getAllByTestId('diff-line-add');
    // querySelectorAll returns NodeList; last <td> is the content cell
    const cells = addRow!.querySelectorAll('td');
    const contentCell = cells[cells.length - 1];
    expect(contentCell?.textContent).not.toMatch(/^\+/);
    expect(contentCell?.textContent).toContain('added line');
  });

  it('strips the leading - sigil so the content cell does not begin with -', () => {
    render(<DiffOutput patch={SAMPLE_PATCH} mode="unified" />);
    const [removeRow] = screen.getAllByTestId('diff-line-remove');
    const cells = removeRow!.querySelectorAll('td');
    const contentCell = cells[cells.length - 1];
    expect(contentCell?.textContent).not.toMatch(/^-/);
    expect(contentCell?.textContent).toContain('removed line');
  });
});

// ─── Split mode ───────────────────────────────────────────────────────────────

describe('DiffOutput — split mode', () => {
  it('renders the diff-output container', () => {
    render(<DiffOutput patch={SAMPLE_PATCH} mode="split" />);
    expect(screen.getByTestId('diff-output')).toBeInTheDocument();
  });

  it('renders left-column cells', () => {
    render(<DiffOutput patch={SAMPLE_PATCH} mode="split" />);
    expect(screen.getAllByTestId('diff-split-left').length).toBeGreaterThan(0);
  });

  it('renders right-column cells', () => {
    render(<DiffOutput patch={SAMPLE_PATCH} mode="split" />);
    expect(screen.getAllByTestId('diff-split-right').length).toBeGreaterThan(0);
  });

  it('renders the same number of left and right cells', () => {
    render(<DiffOutput patch={SAMPLE_PATCH} mode="split" />);
    const left = screen.getAllByTestId('diff-split-left');
    const right = screen.getAllByTestId('diff-split-right');
    expect(left.length).toBe(right.length);
  });

  it('places removed content in the left column', () => {
    render(<DiffOutput patch={SAMPLE_PATCH} mode="split" />);
    const leftTexts = screen.getAllByTestId('diff-split-left').map((el) => el.textContent);
    expect(leftTexts.some((t) => t?.includes('removed line'))).toBe(true);
  });

  it('places added content in the right column', () => {
    render(<DiffOutput patch={SAMPLE_PATCH} mode="split" />);
    const rightTexts = screen.getAllByTestId('diff-split-right').map((el) => el.textContent);
    expect(rightTexts.some((t) => t?.includes('added line'))).toBe(true);
  });

  it('does not place removed content in the right column', () => {
    render(<DiffOutput patch={SAMPLE_PATCH} mode="split" />);
    const rightTexts = screen.getAllByTestId('diff-split-right').map((el) => el.textContent);
    expect(rightTexts.some((t) => t?.includes('removed line'))).toBe(false);
  });

  it('does not place added content in the left column', () => {
    render(<DiffOutput patch={SAMPLE_PATCH} mode="split" />);
    const leftTexts = screen.getAllByTestId('diff-split-left').map((el) => el.textContent);
    expect(leftTexts.some((t) => t?.includes('added line'))).toBe(false);
  });

  it('places a remove and its paired add in the same table row', () => {
    render(<DiffOutput patch={SAMPLE_PATCH} mode="split" />);
    const leftCells = screen.getAllByTestId('diff-split-left');
    const removeCell = leftCells.find((el) => el.textContent?.includes('removed line'));
    const row = removeCell?.closest('tr');
    const rightCell = row ? within(row).getByTestId('diff-split-right') : null;
    expect(rightCell?.textContent).toBe('added line');
  });

  it('renders header lines spanning the full row', () => {
    render(<DiffOutput patch={SAMPLE_PATCH} mode="split" />);
    expect(screen.getAllByTestId('diff-line-header').length).toBeGreaterThan(0);
  });

  it('places context lines in both left and right columns', () => {
    render(<DiffOutput patch={SAMPLE_PATCH} mode="split" />);
    const leftTexts = screen.getAllByTestId('diff-split-left').map((el) => el.textContent);
    const rightTexts = screen.getAllByTestId('diff-split-right').map((el) => el.textContent);
    expect(leftTexts.some((t) => t?.includes('context line'))).toBe(true);
    expect(rightTexts.some((t) => t?.includes('context line'))).toBe(true);
  });
});
