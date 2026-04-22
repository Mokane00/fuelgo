import React from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from '../../utils/clsx';

type Variant = 'primary' | 'accent' | 'outline' | 'danger' | 'ghost';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantMap: Record<Variant, string> = {
  primary: 'btn-primary',
  accent:  'btn-accent',
  outline: 'btn-outline',
  danger:  'btn-danger',
  ghost:   'btn-ghost',
};

const sizeMap: Record<Size, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...rest }, ref) => (
    <button
      ref={ref}
      className={clsx(variantMap[variant], sizeMap[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
