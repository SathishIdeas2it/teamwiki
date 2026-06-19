import type { InputHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
};

export function Input({ error, className = '', ...props }: InputProps): JSX.Element {
  return (
    <div>
      <input
        className={[
          'block w-full rounded-md border px-3 py-2 text-sm shadow-sm',
          'text-gray-900 placeholder-gray-400',
          'dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error
            ? 'border-red-500 focus:ring-red-500 dark:border-red-400'
            : 'border-gray-300 dark:border-gray-700',
          className,
        ].join(' ')}
        {...props}
      />
      {error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
