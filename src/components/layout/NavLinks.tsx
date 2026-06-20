'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  label: string;
  href: string;
  testId: string;
};

const BASE_NAV_ITEMS: NavItem[] = [
  { label: 'Articles', href: '/articles', testId: 'nav-link-articles' },
  { label: 'Tags', href: '/tags', testId: 'nav-link-tags' },
  { label: 'Search', href: '/search', testId: 'nav-link-search' },
];

const ADMIN_NAV_ITEM: NavItem = { label: 'Admin', href: '/admin', testId: 'nav-link-admin' };

type NavLinksProps = {
  isAdmin: boolean;
};

export function NavLinks({ isAdmin }: NavLinksProps): JSX.Element {
  const pathname = usePathname();
  const items = isAdmin ? [...BASE_NAV_ITEMS, ADMIN_NAV_ITEM] : BASE_NAV_ITEMS;

  function isActive(href: string): boolean {
    return pathname.startsWith(href);
  }

  return (
    <ul className="space-y-1" data-testid="nav-links">
      {items.map(({ label, href, testId }) => (
        <li key={href}>
          <Link
            href={href}
            aria-current={isActive(href) ? 'page' : undefined}
            className={[
              'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive(href)
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
            ].join(' ')}
            data-testid={testId}
          >
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
