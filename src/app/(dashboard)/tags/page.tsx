import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Tags' };

export default function TagsPage(): JSX.Element {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">Tags</h1>
      {/* TagGrid component goes here */}
    </div>
  );
}
