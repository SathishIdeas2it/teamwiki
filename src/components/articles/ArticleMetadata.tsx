import type { ArticleWithDetails } from '@/types';

type ArticleMetadataProps = {
  article: Pick<ArticleWithDetails, 'author' | 'publishedAt' | 'updatedAt' | 'revisionCount'>;
};

export function ArticleMetadata({ article }: ArticleMetadataProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
      <span>By {article.author.name}</span>
      {article.publishedAt ? (
        <span>Published {new Date(article.publishedAt).toLocaleDateString()}</span>
      ) : (
        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
          Draft
        </span>
      )}
      <span>Updated {new Date(article.updatedAt).toLocaleDateString()}</span>
      <span>{article.revisionCount} revision{article.revisionCount !== 1 ? 's' : ''}</span>
    </div>
  );
}
