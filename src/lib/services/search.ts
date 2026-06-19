import type { AppSession, SearchResult, PaginatedResult } from '@/types';
import type { SearchQuery } from '@/lib/validations/tag';

export async function search(
  query: SearchQuery,
  session: AppSession,
): Promise<PaginatedResult<SearchResult>> {
  throw new Error('Not implemented');
}
