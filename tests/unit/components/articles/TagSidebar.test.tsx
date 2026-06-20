import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TagSidebar } from '@/components/articles/TagSidebar';
import type { TagWithCategory } from '@/types';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    'data-testid': testId,
    'aria-current': ariaCurrent,
    className,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    'data-testid'?: string;
    'aria-current'?: string;
    className?: string;
    [key: string]: unknown;
  }) => (
    <a
      href={href}
      data-testid={testId}
      aria-current={ariaCurrent}
      className={className}
      {...rest}
    >
      {children}
    </a>
  ),
}));

const TAGS: TagWithCategory[] = [
  { id: '1', name: 'TypeScript', slug: 'typescript', category: null, articleCount: 5 },
  {
    id: '2',
    name: 'React',
    slug: 'react',
    category: { id: 'c1', name: 'Frontend', slug: 'frontend' },
    articleCount: 3,
  },
  { id: '3', name: 'Node.js', slug: 'nodejs', category: null, articleCount: 0 },
];

describe('TagSidebar', () => {
  it('renders the tag-sidebar container', () => {
    render(<TagSidebar tags={TAGS} />);
    expect(screen.getByTestId('tag-sidebar')).toBeInTheDocument();
  });

  it('renders a link for each tag', () => {
    render(<TagSidebar tags={TAGS} />);
    expect(screen.getByTestId('tag-sidebar-tag-typescript')).toBeInTheDocument();
    expect(screen.getByTestId('tag-sidebar-tag-react')).toBeInTheDocument();
    expect(screen.getByTestId('tag-sidebar-tag-nodejs')).toBeInTheDocument();
  });

  it('links point to /tags/<slug>', () => {
    render(<TagSidebar tags={TAGS} />);
    expect(screen.getByTestId('tag-sidebar-tag-typescript')).toHaveAttribute(
      'href',
      '/tags/typescript',
    );
    expect(screen.getByTestId('tag-sidebar-tag-react')).toHaveAttribute('href', '/tags/react');
  });

  it('shows the tag name', () => {
    render(<TagSidebar tags={TAGS} />);
    expect(screen.getByTestId('tag-sidebar-tag-typescript')).toHaveTextContent('TypeScript');
    expect(screen.getByTestId('tag-sidebar-tag-react')).toHaveTextContent('React');
  });

  it('shows the article count for each tag', () => {
    render(<TagSidebar tags={TAGS} />);
    expect(screen.getByTestId('tag-sidebar-tag-typescript')).toHaveTextContent('5');
    expect(screen.getByTestId('tag-sidebar-tag-react')).toHaveTextContent('3');
  });

  it('marks the selected tag with aria-current="page"', () => {
    render(<TagSidebar tags={TAGS} selectedSlug="typescript" />);
    expect(screen.getByTestId('tag-sidebar-tag-typescript')).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('does not mark non-selected tags with aria-current', () => {
    render(<TagSidebar tags={TAGS} selectedSlug="typescript" />);
    expect(screen.getByTestId('tag-sidebar-tag-react')).not.toHaveAttribute('aria-current');
    expect(screen.getByTestId('tag-sidebar-tag-nodejs')).not.toHaveAttribute('aria-current');
  });

  it('renders no links when the tags array is empty', () => {
    render(<TagSidebar tags={[]} />);
    expect(screen.getByTestId('tag-sidebar')).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('has an accessible navigation landmark', () => {
    render(<TagSidebar tags={TAGS} />);
    expect(screen.getByRole('navigation', { name: /tags/i })).toBeInTheDocument();
  });

  it('renders without a selected tag by default', () => {
    render(<TagSidebar tags={TAGS} />);
    screen.getAllByRole('link').forEach((link) => {
      expect(link).not.toHaveAttribute('aria-current');
    });
  });
});
