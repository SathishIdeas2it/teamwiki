import type { ArticleSummary } from '@/types';
import { ArticleCard } from '@/components/articles/ArticleCard';

type ArticleListProps = {
  articles: ArticleSummary[];
};

export function ArticleList({ articles }: ArticleListProps): JSX.Element {
  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-medium text-gray-900 dark:text-gray-100">No articles yet</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Start by creating a new article.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  );
}
