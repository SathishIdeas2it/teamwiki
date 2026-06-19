import type { AppSession, ArticleSummary, ArticleWithDetails, PaginatedResult } from '@/types';
import type { CreateArticleInput, UpdateArticleInput, ArticleListQuery } from '@/lib/validations/article';

export async function listArticles(
  query: ArticleListQuery,
  session: AppSession,
): Promise<PaginatedResult<ArticleSummary>> {
  throw new Error('Not implemented');
}

export async function getArticleBySlug(
  slug: string,
  session: AppSession,
): Promise<ArticleWithDetails> {
  throw new Error('Not implemented');
}

export async function createArticle(
  data: CreateArticleInput,
  session: AppSession,
): Promise<ArticleWithDetails> {
  throw new Error('Not implemented');
}

export async function updateArticle(
  slug: string,
  data: UpdateArticleInput,
  session: AppSession,
): Promise<ArticleWithDetails> {
  throw new Error('Not implemented');
}

export async function deleteArticle(slug: string, session: AppSession): Promise<void> {
  throw new Error('Not implemented');
}

export async function createFromImport(
  data: { title: string; content: string },
  session: AppSession,
): Promise<ArticleWithDetails> {
  throw new Error('Not implemented');
}
