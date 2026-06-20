import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { listTags } from '@/lib/services/tags';
import { TagGrid } from '@/components/articles/TagGrid';
import type { AppSession } from '@/types';

export const metadata: Metadata = { title: 'Tags' };

export default async function TagsPage(): Promise<JSX.Element> {
  const session = (await auth()) as AppSession | null;
  if (!session) redirect('/login');

  const tags = await listTags(session);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">Tags</h1>
      <TagGrid tags={tags} />
    </div>
  );
}
