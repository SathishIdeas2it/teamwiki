import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Search' };

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps): Promise<JSX.Element> {
  const { q } = await searchParams;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Search {q ? `— "${q}"` : ''}
      </h1>
      {/* SearchResults Client Component goes here */}
    </div>
  );
}
