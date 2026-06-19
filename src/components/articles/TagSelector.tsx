'use client';

import { useState } from 'react';
import type { TagSummary } from '@/types';
import { TagBadge } from '@/components/articles/TagBadge';

type TagSelectorProps = {
  availableTags: TagSummary[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
};

export function TagSelector({
  availableTags,
  selectedTagIds,
  onChange,
}: TagSelectorProps): JSX.Element {
  const [query, setQuery] = useState('');

  const filtered = availableTags.filter(
    (t) =>
      t.name.toLowerCase().includes(query.toLowerCase()) && !selectedTagIds.includes(t.id),
  );

  const selectedTags = availableTags.filter((t) => selectedTagIds.includes(t.id));

  function toggleTag(tagId: string): void {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  }

  return (
    <div data-testid="tag-selector">
      <div className="flex flex-wrap gap-2 mb-2">
        {selectedTags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => toggleTag(tag.id)}
            type="button"
            className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-900/40 dark:text-brand-300"
          >
            {tag.name}
            <span aria-hidden>×</span>
          </button>
        ))}
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search tags…"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        data-testid="tag-selector-input"
      />
      {query && filtered.length > 0 ? (
        <ul className="mt-1 rounded-md border bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          {filtered.map((tag) => (
            <li key={tag.id}>
              <button
                type="button"
                onClick={() => { toggleTag(tag.id); setQuery(''); }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <TagBadge tag={tag} asLink={false} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
