import type { Metadata } from 'next';
import { RegisterForm } from '@/components/ui/RegisterForm';

export const metadata: Metadata = { title: 'Create Account' };

export default function RegisterPage(): JSX.Element {
  return (
    <div className="rounded-lg border bg-white p-8 shadow-card dark:bg-gray-900">
      <h2 className="mb-6 text-xl font-semibold text-gray-900 dark:text-gray-100">
        Create account
      </h2>
      <RegisterForm />
    </div>
  );
}
