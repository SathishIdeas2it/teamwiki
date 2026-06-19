'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';
import { SearchResultCard } from '@/components/search/SearchResultCard';
import type { SearchResult } from '@/types';

export function SearchResults(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    const params = new URLSearchParams({ q: debouncedQuery });
    fetch(`/api/search?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as { data?: SearchResult[] };
        setResults(data.data ?? []);
      })
      .catch(() => setResults([]))
      .finally(() => setIsLoading(false));
  }, [debouncedQuery]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (debouncedQuery) {
      params.set('q', debouncedQuery);
    } else {
      params.delete('q');
    }
    router.replace(`/search?${params.toString()}`, { scroll: false });
  }, [debouncedQuery, router, searchParams]);

  return (
    <div data-testid="search-results">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search articles…"
        className="mb-6 w-full rounded-lg border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        data-testid="search-input"
        autoFocus
      />

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-4">
          {results.map((result) => (
            <SearchResultCard key={result.id} result={result} />
          ))}
        </div>
      ) : debouncedQuery ? (
        <p className="text-gray-500 dark:text-gray-400">No results for "{debouncedQuery}"</p>
      ) : null}
    </div>
  );
}
