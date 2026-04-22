import React from 'react';
import { clsx } from '../../utils/clsx';

type BadgeVariant = 'primary' | 'accent' | 'success' | 'danger' | 'warning' | 'default';

const variantMap: Record<BadgeVariant, string> = {
  primary: 'badge-primary',
  accent:  'badge-accent',
  success: 'badge-success',
  danger:  'badge-danger',
  warning: 'badge-warning',
  default: 'badge bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = 'default', className, children, ...rest }: BadgeProps) {
  return (
    <span className={clsx(variantMap[variant], className)} {...rest}>
      {children}
    </span>
  );
}
