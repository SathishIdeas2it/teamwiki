import type { LabelHTMLAttributes, ReactNode } from 'react';

type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  required?: boolean;
  children: ReactNode;
};

export function Label({ required, children, className = '', ...props }: LabelProps): JSX.Element {
  return (
    <label
      className={['block text-sm font-medium text-gray-700 dark:text-gray-300', className].join(
        ' ',
      )}
      {...props}
    >
      {children}
      {required ? <span className="ml-1 text-red-500">*</span> : null}
    </label>
  );
}
