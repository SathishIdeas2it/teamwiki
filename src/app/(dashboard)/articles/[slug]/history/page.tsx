import type { Metadata } from 'next';

type ArticleHistoryPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ArticleHistoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `History: ${slug}` };
}

export default async function ArticleHistoryPage({ params }: ArticleHistoryPageProps): Promise<JSX.Element> {
  const { slug } = await params;
  void slug;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Revision History
      </h1>
      {/* RevisionList + DiffViewer components go here */}
    </div>
  );
}
