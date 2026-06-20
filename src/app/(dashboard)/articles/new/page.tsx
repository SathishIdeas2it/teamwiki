import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { listTags } from '@/lib/services/tags';
import { hasPermission } from '@/lib/auth/permissions';
import { ArticleEditorForm } from '@/components/editor/ArticleEditorForm';
import type { AppSession } from '@/types';

export const metadata: Metadata = { title: 'New Article' };

export default async function NewArticlePage(): Promise<JSX.Element> {
  const session = (await auth()) as AppSession | null;
  if (!session) redirect('/login');
  if (!hasPermission(session.user.role, 'article:create')) redirect('/articles');

  const tags = await listTags(session);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">New Article</h1>
      <ArticleEditorForm availableTags={tags} />
    </div>
  );
}
