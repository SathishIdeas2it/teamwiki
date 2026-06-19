'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

export function RegisterForm(): JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: formData.get('email'),
        name: formData.get('name'),
        password: formData.get('password'),
      }),
    });

    setIsLoading(false);

    if (!res.ok) {
      const data = await res.json() as { error?: { message?: string } };
      setError(data.error?.message ?? 'Registration failed');
      return;
    }

    router.push('/login');
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4" noValidate>
      {error ? (
        <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="name" required>Full name</Label>
        <Input id="name" name="name" type="text" autoComplete="name" required data-testid="register-name-input" />
      </div>

      <div className="space-y-1">
        <Label htmlFor="email" required>Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required data-testid="register-email-input" />
      </div>

      <div className="space-y-1">
        <Label htmlFor="password" required>Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required data-testid="register-password-input" />
        <p className="text-xs text-gray-500 dark:text-gray-400">Min 8 chars, 1 uppercase, 1 number</p>
      </div>

      <Button type="submit" isLoading={isLoading} className="w-full" data-testid="register-submit-button">
        Create account
      </Button>
    </form>
  );
}
