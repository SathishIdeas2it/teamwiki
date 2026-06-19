import type { AppSession, TagWithCategory, ArticleSummary, PaginatedResult } from '@/types';
import type { CreateTagInput, UpdateTagInput } from '@/lib/validations/tag';

export async function listTags(session: AppSession): Promise<TagWithCategory[]> {
  throw new Error('Not implemented');
}

export async function createTag(
  data: CreateTagInput,
  session: AppSession,
): Promise<TagWithCategory> {
  throw new Error('Not implemented');
}

export async function updateTag(
  slug: string,
  data: UpdateTagInput,
  session: AppSession,
): Promise<TagWithCategory> {
  throw new Error('Not implemented');
}

export async function deleteTag(slug: string, session: AppSession): Promise<void> {
  throw new Error('Not implemented');
}

export async function listArticlesByTag(
  slug: string,
  page: number,
  limit: number,
  session: AppSession,
): Promise<PaginatedResult<ArticleSummary>> {
  throw new Error('Not implemented');
}
