import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'New Article' };

export default function NewArticlePage(): JSX.Element {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        New Article
      </h1>
      {/* ArticleEditorForm component goes here */}
    </div>
  );
}
