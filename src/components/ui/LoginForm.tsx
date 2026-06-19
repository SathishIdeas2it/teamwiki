'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';

export function LoginForm(): JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirect: false,
    });

    setIsLoading(false);

    if (result?.error) {
      setError('Invalid email or password');
      return;
    }

    router.push('/articles');
    router.refresh();
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4" noValidate>
      {error ? (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400"
        >
          {error}
        </div>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="email" required>Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          data-testid="login-email-input"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="password" required>Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          data-testid="login-password-input"
        />
      </div>

      <Button
        type="submit"
        isLoading={isLoading}
        className="w-full"
        data-testid="login-submit-button"
      >
        Sign in
      </Button>
    </form>
  );
}
