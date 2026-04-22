import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { clsx } from '../../utils/clsx';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

export function Modal({ open, onClose, title, children, size = 'md', className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      {/* Panel */}
      <div className={clsx('relative bg-white dark:bg-surface-dark rounded-lg shadow-xl w-full animate-scale-in', sizeMap[size], className)}>
        {title && (
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border dark:border-white/10">
            <h3 className="text-base font-heading font-semibold text-gray-900 dark:text-white">{title}</h3>
            <button onClick={onClose} className="btn-ghost p-1 rounded-sm">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className={clsx('p-5', !title && 'pt-5')}>
          {!title && (
            <button onClick={onClose} className="absolute top-3 right-3 btn-ghost p-1 rounded-sm">
              <X className="w-4 h-4" />
            </button>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
