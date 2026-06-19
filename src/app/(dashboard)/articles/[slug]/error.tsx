'use client';

import { useEffect } from 'react';

type ArticleErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ArticleError({ error, reset }: ArticleErrorProps): JSX.Element {
  useEffect(() => {
    void error;
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        Something went wrong
      </h2>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Failed to load the article. Please try again.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 dark:bg-brand-500"
        data-testid="error-retry-button"
      >
        Try again
      </button>
    </div>
  );
}
