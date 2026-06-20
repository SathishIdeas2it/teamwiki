import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { getArticleBySlug } from '@/lib/services/articles';
import { listTags } from '@/lib/services/tags';
import { canEditArticle } from '@/lib/auth/permissions';
import { NotFoundError } from '@/lib/errors';
import { ArticleEditorForm } from '@/components/editor/ArticleEditorForm';
import type { AppSession } from '@/types';

type EditArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: EditArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Edit: ${slug}` };
}

export default async function EditArticlePage({ params }: EditArticlePageProps): Promise<JSX.Element> {
  const session = (await auth()) as AppSession | null;
  if (!session) redirect('/login');

  const { slug } = await params;

  let article;
  try {
    article = await getArticleBySlug(slug, session);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  if (!canEditArticle(session, { authorId: article.author.id })) {
    redirect(`/articles/${slug}`);
  }

  const tags = await listTags(session);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Article</h1>
      <ArticleEditorForm
        initialData={{
          title: article.title,
          content: article.content,
          tagIds: article.tags.map((t) => t.id),
          status: article.status,
        }}
        slug={slug}
        availableTags={tags}
      />
    </div>
  );
}
