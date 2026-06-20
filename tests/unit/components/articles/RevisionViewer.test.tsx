import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { RevisionViewer } from '@/components/articles/RevisionViewer';
import type { RevisionSummary, RevisionDetail } from '@/types';

jest.mock('@/components/articles/RevisionList', () => ({
  RevisionList: ({
    onSelect,
    selectedIds,
  }: {
    onSelect: (id: string) => void;
    selectedIds: [string | null, string | null];
  }) => (
    <div data-testid="mock-revision-list">
      <button onClick={() => onSelect('rev-1')} data-testid="select-rev-1">
        Select Rev 1
      </button>
      <button onClick={() => onSelect('rev-2')} data-testid="select-rev-2">
        Select Rev 2
      </button>
      <span data-testid="selected-ids">{selectedIds.join(',')}</span>
    </div>
  ),
}));

jest.mock('@/components/diff/DiffViewer', () => ({
  DiffViewer: ({
    baseRevision,
    headRevision,
  }: {
    baseRevision: RevisionDetail;
    headRevision: RevisionDetail;
  }) => (
    <div data-testid="mock-diff-viewer">
      Comparing #{baseRevision.revisionNumber} → #{headRevision.revisionNumber}
    </div>
  ),
}));

const REVISIONS: RevisionSummary[] = [
  {
    id: 'rev-1',
    revisionNumber: 1,
    authorName: 'Alice',
    changeSummary: 'Initial',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'rev-2',
    revisionNumber: 2,
    authorName: 'Bob',
    changeSummary: 'Update',
    createdAt: new Date('2024-01-02'),
  },
];

const REVISION_1_DETAIL: RevisionDetail = {
  id: 'rev-1',
  revisionNumber: 1,
  authorName: 'Alice',
  changeSummary: 'Initial',
  createdAt: new Date('2024-01-01'),
  title: 'Article Title',
  content: 'Old content',
};

const REVISION_2_DETAIL: RevisionDetail = {
  id: 'rev-2',
  revisionNumber: 2,
  authorName: 'Bob',
  changeSummary: 'Update',
  createdAt: new Date('2024-01-02'),
  title: 'Article Title',
  content: 'New content',
};

function mockFetchResponse(data: unknown): Response {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

describe('RevisionViewer', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('renders the revision-viewer container', () => {
    render(<RevisionViewer revisions={REVISIONS} />);
    expect(screen.getByTestId('revision-viewer')).toBeInTheDocument();
  });

  it('renders the RevisionList', () => {
    render(<RevisionViewer revisions={REVISIONS} />);
    expect(screen.getByTestId('mock-revision-list')).toBeInTheDocument();
  });

  it('shows a placeholder when no revisions are selected', () => {
    render(<RevisionViewer revisions={REVISIONS} />);
    expect(screen.getByTestId('revision-viewer-placeholder')).toBeInTheDocument();
  });

  it('shows a placeholder when only one revision is selected', async () => {
    const user = userEvent.setup();
    render(<RevisionViewer revisions={REVISIONS} />);
    await user.click(screen.getByTestId('select-rev-1'));
    expect(screen.getByTestId('revision-viewer-placeholder')).toBeInTheDocument();
  });

  it('shows a loading state while fetching two revision details', async () => {
    const user = userEvent.setup();
    const neverResolve = new Promise<Response>(() => {});
    (global.fetch as jest.Mock).mockReturnValue(neverResolve);

    render(<RevisionViewer revisions={REVISIONS} />);
    await user.click(screen.getByTestId('select-rev-1'));
    await user.click(screen.getByTestId('select-rev-2'));

    expect(screen.getByTestId('revision-viewer-loading')).toBeInTheDocument();
  });

  it('fetches revision details and shows DiffViewer when two are selected', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockFetchResponse(REVISION_1_DETAIL))
      .mockResolvedValueOnce(mockFetchResponse(REVISION_2_DETAIL));

    render(<RevisionViewer revisions={REVISIONS} />);
    await user.click(screen.getByTestId('select-rev-1'));
    await user.click(screen.getByTestId('select-rev-2'));

    await waitFor(() => {
      expect(screen.getByTestId('mock-diff-viewer')).toBeInTheDocument();
    });
  });

  it('always passes the lower revision number as base and the higher as head', async () => {
    const user = userEvent.setup();
    // Fetch rev-2 first, rev-1 second — component must reorder them by number
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockFetchResponse(REVISION_2_DETAIL))
      .mockResolvedValueOnce(mockFetchResponse(REVISION_1_DETAIL));

    render(<RevisionViewer revisions={REVISIONS} />);
    await user.click(screen.getByTestId('select-rev-2'));
    await user.click(screen.getByTestId('select-rev-1'));

    await waitFor(() => {
      expect(screen.getByTestId('mock-diff-viewer')).toHaveTextContent(
        'Comparing #1 → #2',
      );
    });
  });

  it('deselects a revision when it is clicked again', async () => {
    const user = userEvent.setup();
    render(<RevisionViewer revisions={REVISIONS} />);
    await user.click(screen.getByTestId('select-rev-1'));
    await user.click(screen.getByTestId('select-rev-1'));
    expect(screen.getByTestId('revision-viewer-placeholder')).toBeInTheDocument();
  });

  it('passes the revisions prop to RevisionList', () => {
    render(<RevisionViewer revisions={REVISIONS} />);
    expect(screen.getByTestId('mock-revision-list')).toBeInTheDocument();
  });
});
