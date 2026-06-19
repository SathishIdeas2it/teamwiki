// remark/rehype are ESM-only packages incompatible with Jest's CJS runner.
// We mock them and verify renderMarkdown correctly chains through the pipeline.
// Actual XSS sanitization is guaranteed by rehype-sanitize (tested upstream)
// and verified in e2e tests.

const processMock = jest.fn().mockResolvedValue({ toString: () => '<p>rendered</p>' });
const useMock = jest.fn();
useMock.mockReturnValue({ use: useMock, process: processMock });
const remarkInstance = { use: useMock, process: processMock };

jest.mock('remark', () => ({ remark: jest.fn(() => remarkInstance) }));
jest.mock('remark-gfm', () => ({ default: {} }));
jest.mock('remark-rehype', () => ({ default: {} }));
jest.mock('rehype-sanitize', () => ({ default: {} }));
jest.mock('rehype-stringify', () => ({ default: {} }));

import { renderMarkdown } from '@/lib/utils/markdown';

describe('renderMarkdown', () => {
  it('returns a string', async () => {
    const result = await renderMarkdown('# Hello');
    expect(typeof result).toBe('string');
  });

  it('calls process() on the remark pipeline with the input content', async () => {
    await renderMarkdown('some content');
    expect(processMock).toHaveBeenCalledWith('some content');
  });

  it('chains exactly 4 plugins through the pipeline', async () => {
    await renderMarkdown('content');
    expect(useMock).toHaveBeenCalledTimes(4);
  });

  it('returns the string representation of the pipeline result', async () => {
    processMock.mockResolvedValueOnce({ toString: () => '<h1>Title</h1>' });
    const result = await renderMarkdown('# Title');
    expect(result).toBe('<h1>Title</h1>');
  });

  it('handles empty input without throwing', async () => {
    processMock.mockResolvedValueOnce({ toString: () => '' });
    await expect(renderMarkdown('')).resolves.toBe('');
  });

  it('handles multi-line markdown without throwing', async () => {
    processMock.mockResolvedValueOnce({ toString: () => '<p>line1</p><p>line2</p>' });
    const result = await renderMarkdown('line1\n\nline2');
    expect(result).toBe('<p>line1</p><p>line2</p>');
  });
});
