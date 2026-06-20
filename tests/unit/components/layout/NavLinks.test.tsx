import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NavLinks } from '@/components/layout/NavLinks';

const mockUsePathname = jest.fn<string, []>();

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

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

describe('NavLinks', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/articles');
  });

  it('renders the nav-links container', () => {
    render(<NavLinks isAdmin={false} />);
    expect(screen.getByTestId('nav-links')).toBeInTheDocument();
  });

  it('renders an Articles link pointing to /articles', () => {
    render(<NavLinks isAdmin={false} />);
    expect(screen.getByTestId('nav-link-articles')).toHaveAttribute('href', '/articles');
  });

  it('renders a Tags link pointing to /tags', () => {
    render(<NavLinks isAdmin={false} />);
    expect(screen.getByTestId('nav-link-tags')).toHaveAttribute('href', '/tags');
  });

  it('renders a Search link pointing to /search', () => {
    render(<NavLinks isAdmin={false} />);
    expect(screen.getByTestId('nav-link-search')).toHaveAttribute('href', '/search');
  });

  it('renders an Admin link when isAdmin is true', () => {
    render(<NavLinks isAdmin={true} />);
    expect(screen.getByTestId('nav-link-admin')).toHaveAttribute('href', '/admin');
  });

  it('does not render an Admin link when isAdmin is false', () => {
    render(<NavLinks isAdmin={false} />);
    expect(screen.queryByTestId('nav-link-admin')).not.toBeInTheDocument();
  });

  it('marks the current route with aria-current="page"', () => {
    mockUsePathname.mockReturnValue('/articles');
    render(<NavLinks isAdmin={false} />);
    expect(screen.getByTestId('nav-link-articles')).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark non-current links with aria-current', () => {
    mockUsePathname.mockReturnValue('/articles');
    render(<NavLinks isAdmin={false} />);
    expect(screen.getByTestId('nav-link-tags')).not.toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('nav-link-search')).not.toHaveAttribute('aria-current', 'page');
  });

  it('marks the admin link as current when on an admin sub-page', () => {
    mockUsePathname.mockReturnValue('/admin/users');
    render(<NavLinks isAdmin={true} />);
    expect(screen.getByTestId('nav-link-admin')).toHaveAttribute('aria-current', 'page');
  });

  it('marks the articles link as current on an article detail page', () => {
    mockUsePathname.mockReturnValue('/articles/my-post');
    render(<NavLinks isAdmin={false} />);
    expect(screen.getByTestId('nav-link-articles')).toHaveAttribute('aria-current', 'page');
  });

  it('displays readable link labels', () => {
    render(<NavLinks isAdmin={true} />);
    expect(screen.getByTestId('nav-link-articles')).toHaveTextContent('Articles');
    expect(screen.getByTestId('nav-link-tags')).toHaveTextContent('Tags');
    expect(screen.getByTestId('nav-link-search')).toHaveTextContent('Search');
    expect(screen.getByTestId('nav-link-admin')).toHaveTextContent('Admin');
  });
});
