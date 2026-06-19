import { db } from '@/lib/db/client';
import type { SearchResult } from '@/types';

export async function fullTextSearch(
  query: string,
  tagSlugs: string[],
  limit: number,
  offset: number,
): Promise<SearchResult[]> {
  const results = await db.$queryRaw<
    Array<{
      id: string;
      slug: string;
      title: string;
      author_name: string;
      published_at: Date | null;
      rank: number;
      excerpt: string;
    }>
  >`
    SELECT
      a.id,
      a.slug,
      a.title,
      u.name AS author_name,
      a.published_at,
      ts_rank_cd(a.search_vector, q) AS rank,
      ts_headline(
        'english',
        a.content,
        q,
        'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
      ) AS excerpt
    FROM articles a
    JOIN users u ON u.id = a.author_id,
         websearch_to_tsquery('english', ${query}) AS q
    WHERE a.search_vector @@ q
      AND a.status = 'PUBLISHED'
      AND a.deleted_at IS NULL
      AND (
        ${tagSlugs.length === 0}
        OR EXISTS (
          SELECT 1 FROM article_tags at2
          JOIN tags t ON t.id = at2.tag_id
          WHERE at2.article_id = a.id
            AND t.slug = ANY(${tagSlugs})
        )
      )
    ORDER BY rank DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return results.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    authorName: r.author_name,
    publishedAt: r.published_at,
    rank: Number(r.rank),
    excerpt: r.excerpt,
  }));
}

export async function countSearchResults(
  query: string,
  tagSlugs: string[],
): Promise<number> {
  const result = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count
    FROM articles a,
         websearch_to_tsquery('english', ${query}) AS q
    WHERE a.search_vector @@ q
      AND a.status = 'PUBLISHED'
      AND a.deleted_at IS NULL
      AND (
        ${tagSlugs.length === 0}
        OR EXISTS (
          SELECT 1 FROM article_tags at2
          JOIN tags t ON t.id = at2.tag_id
          WHERE at2.article_id = a.id
            AND t.slug = ANY(${tagSlugs})
        )
      )
  `;
  return Number(result[0]?.count ?? 0);
}
