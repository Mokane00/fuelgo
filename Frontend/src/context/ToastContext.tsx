import React, { createContext, useCallback, useContext, useState } from 'react';
import type { Toast, ToastType } from '../types';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

interface ToastContextValue {
  toast: (type: ToastType, message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastItem({ t, onRemove }: { t: Toast; onRemove: (id: string) => void }) {
  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />,
    error:   <XCircle     className="w-5 h-5 text-danger  flex-shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />,
    info:    <Info          className="w-5 h-5 text-primary-light flex-shrink-0" />,
  };
  const bg: Record<ToastType, string> = {
    success: 'bg-green-50  dark:bg-green-900/30  border-success',
    error:   'bg-red-50    dark:bg-red-900/30    border-danger',
    warning: 'bg-yellow-50 dark:bg-yellow-900/30 border-warning',
    info:    'bg-blue-50   dark:bg-blue-900/30   border-primary-light',
  };
  return (
    <div className={`flex items-start gap-3 p-3 pr-4 rounded-md border shadow-md max-w-sm w-full animate-slide-up ${bg[t.type]}`}>
      {icons[t.type]}
      <p className="text-sm text-gray-800 dark:text-gray-100 flex-1">{t.message}</p>
      <button onClick={() => onRemove(t.id)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) =>
    setToasts(prev => prev.filter(t => t.id !== id)), []);

  const toast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message, duration }]);
    setTimeout(() => remove(id), duration);
  }, [remove]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 items-end no-print">
        {toasts.map(t => <ToastItem key={t.id} t={t} onRemove={remove} />)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx.toast;
}
