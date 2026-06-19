import { fullTextSearch, countSearchResults } from '@/lib/db/search';
import type { AppSession, SearchResult, PaginatedResult } from '@/types';
import type { SearchQuery } from '@/lib/validations/tag';

export async function search(
  query: SearchQuery,
  session: AppSession,
): Promise<PaginatedResult<SearchResult>> {
  void session;

  const tags = query.tags ?? [];
  const offset = (query.page - 1) * query.limit;

  const [results, total] = await Promise.all([
    fullTextSearch(query.q, tags, query.limit, offset),
    countSearchResults(query.q, tags),
  ]);

  return {
    data: results,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}
