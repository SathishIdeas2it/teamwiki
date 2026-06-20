import { renderMarkdown } from '@/lib/utils/markdown';

type MarkdownPreviewProps = {
  content: string;
};

export async function MarkdownPreview({ content }: MarkdownPreviewProps): Promise<JSX.Element> {
  const html = await renderMarkdown(content);
  return (
    <div
      className="prose max-w-none dark:prose-invert prose-headings:text-gray-900 prose-p:text-gray-700 dark:prose-headings:text-gray-100 dark:prose-p:text-gray-300"
      data-testid="markdown-preview"
      // rehype-sanitize has already removed all unsafe elements and attributes
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
