import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { SearchBar } from '@/components/search/SearchBar';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('SearchBar', () => {
  it('renders the search-bar container', () => {
    render(<SearchBar />);
    expect(screen.getByTestId('search-bar')).toBeInTheDocument();
  });

  it('renders the search input', () => {
    render(<SearchBar />);
    expect(screen.getByTestId('search-bar-input')).toBeInTheDocument();
  });

  it('renders the submit button', () => {
    render(<SearchBar />);
    expect(screen.getByTestId('search-bar-submit')).toBeInTheDocument();
  });

  it('shows the default placeholder', () => {
    render(<SearchBar />);
    expect(screen.getByTestId('search-bar-input')).toHaveAttribute('placeholder', 'Search…');
  });

  it('accepts a custom placeholder', () => {
    render(<SearchBar placeholder="Search articles…" />);
    expect(screen.getByTestId('search-bar-input')).toHaveAttribute(
      'placeholder',
      'Search articles…',
    );
  });

  it('updates the input value as the user types', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    const input = screen.getByTestId('search-bar-input');
    await user.type(input, 'nextjs');
    expect(input).toHaveValue('nextjs');
  });

  it('navigates to /search?q=<query> on form submit', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    await user.type(screen.getByTestId('search-bar-input'), 'nextjs');
    await user.click(screen.getByTestId('search-bar-submit'));
    expect(mockPush).toHaveBeenCalledWith('/search?q=nextjs');
  });

  it('navigates when the user presses Enter', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    await user.type(screen.getByTestId('search-bar-input'), 'typescript{enter}');
    expect(mockPush).toHaveBeenCalledWith('/search?q=typescript');
  });

  it('does not navigate when the query is empty', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    await user.click(screen.getByTestId('search-bar-submit'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not navigate when the query is only whitespace', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    await user.type(screen.getByTestId('search-bar-input'), '   ');
    await user.click(screen.getByTestId('search-bar-submit'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('trims whitespace from the query before navigating', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    await user.type(screen.getByTestId('search-bar-input'), '  nextjs  ');
    await user.click(screen.getByTestId('search-bar-submit'));
    expect(mockPush).toHaveBeenCalledWith('/search?q=nextjs');
  });

  it('has role="search" on the form element', () => {
    render(<SearchBar />);
    expect(screen.getByRole('search')).toBeInTheDocument();
  });
});
