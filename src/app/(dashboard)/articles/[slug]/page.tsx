import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';

type ArticleViewPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ArticleViewPageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug };
}

export default async function ArticleViewPage({ params }: ArticleViewPageProps): Promise<JSX.Element> {
  const { slug } = await params;
  void slug;
  void notFound;

  return (
    <div>
      <Suspense fallback={<ArticleContentSkeleton />}>
        {/* ArticleContent + ArticleActions components go here */}
        <p className="text-gray-500 dark:text-gray-400">Article content coming soon.</p>
      </Suspense>
    </div>
  );
}

function ArticleContentSkeleton(): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="skeleton h-10 w-3/4 rounded" />
      <div className="skeleton h-4 w-1/4 rounded" />
      <div className="skeleton h-64 w-full rounded" />
    </div>
  );
}
