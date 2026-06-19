'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserSummary } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

type UserEditFormProps = {
  user: UserSummary;
};

export function UserEditForm({ user }: UserEditFormProps): JSX.Element {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    setIsLoading(false);

    if (!res.ok) {
      const data = await res.json() as { error?: { message?: string } };
      setError(data.error?.message ?? 'Failed to update user');
      return;
    }

    router.push('/admin/users');
    router.refresh();
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="max-w-md space-y-4">
      {error ? (
        <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="user-email">Email</Label>
        <Input id="user-email" value={user.email} disabled />
      </div>

      <div className="space-y-1">
        <Label htmlFor="user-name" required>Name</Label>
        <Input
          id="user-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          data-testid="user-name-input"
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" isLoading={isLoading} data-testid="save-user-button">
          Save changes
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
