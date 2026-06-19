import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { DiffViewer } from '@/components/diff/DiffViewer';
import type { RevisionDetail } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRevision(overrides: Partial<RevisionDetail> = {}): RevisionDetail {
  return {
    id: 'rev-uuid-1',
    revisionNumber: 1,
    title: 'Test Article',
    content: 'line one\nline two\nline three\n',
    authorName: 'Test Author',
    changeSummary: null,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

const BASE = makeRevision({
  revisionNumber: 1,
  content: 'line one\nline two\nline three\n',
});

const HEAD = makeRevision({
  revisionNumber: 2,
  content: 'line one\nline TWO\nline three\n',
});

// ─── DiffViewer ───────────────────────────────────────────────────────────────

describe('DiffViewer', () => {
  it('renders the diff-viewer container', () => {
    render(<DiffViewer baseRevision={BASE} headRevision={HEAD} />);
    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
  });

  it('displays both revision numbers in the comparison header', () => {
    render(<DiffViewer baseRevision={BASE} headRevision={HEAD} />);
    const label = screen.getByTestId('diff-comparison-label');
    expect(within(label).getByText('#1', { exact: false })).toBeInTheDocument();
    expect(within(label).getByText('#2', { exact: false })).toBeInTheDocument();
  });

  it('renders the unified and split mode toggle buttons', () => {
    render(<DiffViewer baseRevision={BASE} headRevision={HEAD} />);
    expect(screen.getByTestId('diff-mode-unified')).toBeInTheDocument();
    expect(screen.getByTestId('diff-mode-split')).toBeInTheDocument();
  });

  it('renders the diff output container', () => {
    render(<DiffViewer baseRevision={BASE} headRevision={HEAD} />);
    expect(screen.getByTestId('diff-output')).toBeInTheDocument();
  });

  it('starts in unified mode — no split columns are present', () => {
    render(<DiffViewer baseRevision={BASE} headRevision={HEAD} />);
    expect(screen.queryAllByTestId('diff-split-left')).toHaveLength(0);
  });

  it('shows changed lines in unified mode', () => {
    render(<DiffViewer baseRevision={BASE} headRevision={HEAD} />);
    // "line two" was changed to "line TWO" — both directions should appear
    expect(screen.getAllByTestId('diff-line-remove').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('diff-line-add').length).toBeGreaterThan(0);
  });

  it('switches to split mode when the split button is clicked', async () => {
    const user = userEvent.setup();
    render(<DiffViewer baseRevision={BASE} headRevision={HEAD} />);

    await user.click(screen.getByTestId('diff-mode-split'));

    expect(screen.queryAllByTestId('diff-split-left').length).toBeGreaterThan(0);
  });

  it('switches back to unified mode when unified button is clicked after split', async () => {
    const user = userEvent.setup();
    render(<DiffViewer baseRevision={BASE} headRevision={HEAD} />);

    await user.click(screen.getByTestId('diff-mode-split'));
    await user.click(screen.getByTestId('diff-mode-unified'));

    expect(screen.queryAllByTestId('diff-split-left')).toHaveLength(0);
  });

  it('in split mode, removed content appears in the left column', async () => {
    const user = userEvent.setup();
    render(<DiffViewer baseRevision={BASE} headRevision={HEAD} />);

    await user.click(screen.getByTestId('diff-mode-split'));

    const leftTexts = screen.getAllByTestId('diff-split-left').map((el) => el.textContent);
    expect(leftTexts.some((t) => t?.includes('line two'))).toBe(true);
  });

  it('in split mode, added content appears in the right column', async () => {
    const user = userEvent.setup();
    render(<DiffViewer baseRevision={BASE} headRevision={HEAD} />);

    await user.click(screen.getByTestId('diff-mode-split'));

    const rightTexts = screen.getAllByTestId('diff-split-right').map((el) => el.textContent);
    expect(rightTexts.some((t) => t?.includes('line TWO'))).toBe(true);
  });
});
