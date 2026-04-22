import React from 'react';
import { clsx } from '../../utils/clsx';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: string; positive: boolean };
  className?: string;
}

export function StatCard({ label, value, icon, trend, className }: StatCardProps) {
  return (
    <div className={clsx('card flex items-start gap-4', className)}>
      {icon && (
        <div className="w-11 h-11 rounded-md bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary dark:text-blue-300 flex-shrink-0">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">{label}</p>
        <p className="text-2xl font-heading font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
        {trend && (
          <p className={clsx('text-xs mt-1', trend.positive ? 'text-success' : 'text-danger')}>
            {trend.positive ? '▲' : '▼'} {trend.value}
          </p>
        )}
      </div>
    </div>
  );
}
