import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockRenderMarkdown = jest.fn<Promise<string>, [string]>();
jest.mock('@/lib/utils/markdown', () => ({
  renderMarkdown: mockRenderMarkdown,
}));

// Import after mock so the component picks up the mocked dependency.
import { MarkdownPreview } from '@/components/articles/MarkdownPreview';

describe('MarkdownPreview', () => {
  beforeEach(() => {
    mockRenderMarkdown.mockResolvedValue('<p><strong>Hello</strong> world</p>');
  });

  it('renders the markdown-preview container', async () => {
    const element = await MarkdownPreview({ content: '**Hello** world' });
    render(element);
    expect(screen.getByTestId('markdown-preview')).toBeInTheDocument();
  });

  it('calls renderMarkdown with the provided content', async () => {
    const content = '**Hello** world';
    await MarkdownPreview({ content });
    expect(mockRenderMarkdown).toHaveBeenCalledWith(content);
  });

  it('renders the HTML returned by renderMarkdown', async () => {
    mockRenderMarkdown.mockResolvedValue('<p>Test paragraph</p>');
    const element = await MarkdownPreview({ content: 'Test paragraph' });
    const { container } = render(element);
    expect(container.querySelector('p')).toHaveTextContent('Test paragraph');
  });

  it('applies the prose class for typography styling', async () => {
    const element = await MarkdownPreview({ content: '# Hello' });
    render(element);
    expect(screen.getByTestId('markdown-preview').className).toContain('prose');
  });

  it('applies dark mode prose class', async () => {
    const element = await MarkdownPreview({ content: '# Hello' });
    render(element);
    expect(screen.getByTestId('markdown-preview').className).toContain('dark:prose-invert');
  });

  it('renders only what renderMarkdown returns — does not bypass sanitisation', async () => {
    mockRenderMarkdown.mockResolvedValue('<p>Safe content</p>');
    const element = await MarkdownPreview({ content: '<script>alert("xss")</script>' });
    render(element);
    const preview = screen.getByTestId('markdown-preview');
    expect(preview.innerHTML).toContain('Safe content');
    expect(preview.innerHTML).not.toContain('<script>');
  });
});
