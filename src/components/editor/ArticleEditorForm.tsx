'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ArticleStatus } from '@prisma/client';
import type { TagSummary } from '@/types';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { TagSelector } from '@/components/articles/TagSelector';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

type ArticleEditorFormProps = {
  initialData?: {
    title: string;
    content: string;
    tagIds: string[];
    status: ArticleStatus;
  };
  slug?: string;
  availableTags: TagSummary[];
};

export function ArticleEditorForm({
  initialData,
  slug,
  availableTags,
}: ArticleEditorFormProps): JSX.Element {
  const router = useRouter();
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [tagIds, setTagIds] = useState<string[]>(initialData?.tagIds ?? []);
  const [status, setStatus] = useState<ArticleStatus>(initialData?.status ?? 'DRAFT');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!slug;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const url = isEditing ? `/api/articles/${slug}` : '/api/articles';
    const method = isEditing ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, tagIds, status }),
    });

    setIsLoading(false);

    if (!res.ok) {
      const data = await res.json() as { error?: { message?: string } };
      setError(data.error?.message ?? 'Failed to save article');
      return;
    }

    const article = await res.json() as { slug: string };
    router.push(`/articles/${article.slug}`);
    router.refresh();
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6" noValidate>
      {error ? (
        <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="article-title" required>Title</Label>
        <Input
          id="article-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          data-testid="article-title-input"
        />
      </div>

      <div className="space-y-1">
        <Label required>Content</Label>
        <MarkdownEditor initialValue={content} onChange={setContent} />
      </div>

      <div className="space-y-1">
        <Label>Tags</Label>
        <TagSelector availableTags={availableTags} selectedTagIds={tagIds} onChange={setTagIds} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="article-status">Status</Label>
        <select
          id="article-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ArticleStatus)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          data-testid="status-selector"
        >
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      <div className="flex gap-3">
        <Button type="submit" isLoading={isLoading} data-testid="submit-button">
          {isEditing ? 'Save changes' : 'Create article'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
