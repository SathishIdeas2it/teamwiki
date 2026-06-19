import { slugify, slugifyWithSuffix } from '@/lib/utils/slugify';

describe('slugify', () => {
  it('converts text to lowercase', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugify('hello world')).toBe('hello-world');
  });

  it('trims leading and trailing whitespace before slugifying', () => {
    expect(slugify('  hello world  ')).toBe('hello-world');
  });

  it('removes special characters', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });

  it('collapses multiple consecutive hyphens into one', () => {
    expect(slugify('hello--world')).toBe('hello-world');
  });

  it('collapses multiple spaces into a single hyphen', () => {
    expect(slugify('hello   world')).toBe('hello-world');
  });

  it('strips leading and trailing hyphens from the result', () => {
    expect(slugify('-hello-world-')).toBe('hello-world');
  });

  it('treats underscores as word separators', () => {
    expect(slugify('hello_world')).toBe('hello-world');
  });

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(slugify('   ')).toBe('');
  });

  it('preserves numbers in text', () => {
    expect(slugify('api-v2-design')).toBe('api-v2-design');
  });

  it('leaves already-valid slugs unchanged', () => {
    expect(slugify('valid-slug-123')).toBe('valid-slug-123');
  });

  it('handles mixed case with numbers', () => {
    expect(slugify('TeamWiki 2024 Release')).toBe('teamwiki-2024-release');
  });

  it('collapses mixed whitespace and hyphens', () => {
    expect(slugify('hello - world')).toBe('hello-world');
  });
});

describe('slugifyWithSuffix', () => {
  it('appends numeric suffix separated by hyphen', () => {
    expect(slugifyWithSuffix('Hello World', 2)).toBe('hello-world-2');
  });

  it('works with suffix 0', () => {
    expect(slugifyWithSuffix('test', 0)).toBe('test-0');
  });

  it('works with large numeric suffixes', () => {
    expect(slugifyWithSuffix('article', 999)).toBe('article-999');
  });

  it('applies slugify transformation before appending suffix', () => {
    expect(slugifyWithSuffix('Hello World!', 3)).toBe('hello-world-3');
  });
});
