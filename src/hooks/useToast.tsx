'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { txUrl } from '@/lib/config';

type Toast = { id: number; kind: 'ok' | 'err' | 'info'; message: string; tx?: string };
type ToastApi = { notify: (t: Omit<Toast, 'id'>) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);

  const notify = useCallback((t: Omit<Toast, 'id'>) => setToast({ ...t, id: Date.now() }), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.kind === 'err' ? 10_000 : 7_000);
    return () => clearTimeout(timer);
  }, [toast]);

  const link = toast?.tx ? txUrl(toast.tx) : undefined;

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div aria-live="polite" aria-atomic="true">
        {toast && (
          <div
            className={`toast-bar ${toast.kind}`}
            role={toast.kind === 'err' ? 'alert' : 'status'}
            key={toast.id}
          >
            <span>{toast.message}</span>
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer">
                View on explorer
              </a>
            )}
            <button className="icon-btn" onClick={() => setToast(null)} aria-label="Dismiss notification">
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
