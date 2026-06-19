'use client';

import type { Role } from '@prisma/client';

type RoleSelectorProps = {
  value: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
};

const ROLES: Role[] = ['VIEWER', 'EDITOR', 'ADMIN'];

export function RoleSelector({ value, onChange, disabled }: RoleSelectorProps): JSX.Element {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Role)}
      disabled={disabled}
      className="rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
      data-testid="role-selector"
    >
      {ROLES.map((role) => (
        <option key={role} value={role}>
          {role.charAt(0) + role.slice(1).toLowerCase()}
        </option>
      ))}
    </select>
  );
}
