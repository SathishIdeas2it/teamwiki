import type { ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = '' }: CardProps): JSX.Element {
  return (
    <div
      className={[
        'rounded-lg border bg-white shadow-card dark:border-gray-800 dark:bg-gray-900',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: CardProps): JSX.Element {
  return (
    <div className={['border-b px-6 py-4 dark:border-gray-800', className].join(' ')}>
      {children}
    </div>
  );
}

export function CardBody({ children, className = '' }: CardProps): JSX.Element {
  return <div className={['px-6 py-4', className].join(' ')}>{children}</div>;
}
