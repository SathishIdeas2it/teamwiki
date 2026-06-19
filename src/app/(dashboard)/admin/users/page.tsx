import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'User Management' };

export default function UserListPage(): JSX.Element {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        User Management
      </h1>
      {/* UserTable Client Component goes here */}
    </div>
  );
}
