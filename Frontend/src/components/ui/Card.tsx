import React from 'react';
import { clsx } from '../../utils/clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-8' };

export function Card({ padding = 'md', className, children, ...rest }: CardProps) {
  return (
    <div className={clsx('card', paddingMap[padding], className)} {...rest}>
      {children}
    </div>
  );
}
