import type { Metadata } from 'next';

type EditArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: EditArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Edit: ${slug}` };
}

export default async function EditArticlePage({ params }: EditArticlePageProps): Promise<JSX.Element> {
  const { slug } = await params;
  void slug;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Edit Article
      </h1>
      {/* ArticleEditorForm (pre-populated) goes here */}
    </div>
  );
}
