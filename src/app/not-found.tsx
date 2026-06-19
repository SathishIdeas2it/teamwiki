import Link from 'next/link';

export default function NotFound(): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-gray-950">
      <h1 className="text-6xl font-bold text-gray-900 dark:text-gray-100">404</h1>
      <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">Page not found</p>
      <Link
        href="/articles"
        className="mt-8 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
      >
        Back to articles
      </Link>
    </div>
  );
}
