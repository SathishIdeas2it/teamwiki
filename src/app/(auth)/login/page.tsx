import type { Metadata } from 'next';
import { LoginForm } from '@/components/ui/LoginForm';

export const metadata: Metadata = { title: 'Sign In' };

export default function LoginPage(): JSX.Element {
  return (
    <div className="rounded-lg border bg-white p-8 shadow-card dark:bg-gray-900">
      <h2 className="mb-6 text-xl font-semibold text-gray-900 dark:text-gray-100">Sign in</h2>
      <LoginForm />
    </div>
  );
}
