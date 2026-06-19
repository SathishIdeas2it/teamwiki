'use client';

import { useState } from 'react';
import type { Role } from '@prisma/client';
import type { UserSummary } from '@/types';
import { RoleSelector } from '@/components/admin/RoleSelector';
import { Button } from '@/components/ui/Button';

type UserTableProps = {
  users: UserSummary[];
  currentUserId: string;
};

export function UserTable({ users, currentUserId }: UserTableProps): JSX.Element {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleRoleChange(userId: string, role: Role): Promise<void> {
    setLoadingId(userId);
    await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    setLoadingId(null);
  }

  async function handleDeactivate(userId: string): Promise<void> {
    if (!confirm('Deactivate this user?')) return;
    setLoadingId(userId);
    await fetch(`/api/users/${userId}`, { method: 'DELETE' });
    setLoadingId(null);
  }

  return (
    <div className="overflow-x-auto rounded-lg border dark:border-gray-800" data-testid="user-table">
      <table className="min-w-full divide-y dark:divide-gray-800">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            {['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y bg-white dark:divide-gray-800 dark:bg-gray-900">
          {users.map((user) => (
            <tr key={user.id} data-testid={`user-row-${user.id}`}>
              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</td>
              <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
              <td className="px-4 py-3">
                <RoleSelector
                  value={user.role}
                  onChange={(role) => { void handleRoleChange(user.id, role); }}
                  disabled={user.id === currentUserId || loadingId === user.id}
                />
              </td>
              <td className="px-4 py-3">
                <span className={['rounded-full px-2 py-0.5 text-xs font-medium', user.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'].join(' ')}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                {new Date(user.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                {user.id !== currentUserId && user.isActive ? (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => { void handleDeactivate(user.id); }}
                    isLoading={loadingId === user.id}
                    data-testid={`deactivate-user-${user.id}`}
                  >
                    Deactivate
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
