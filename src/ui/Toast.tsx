import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import styles from './Toast.module.css';
import { ToastContext } from './toastContext';

const VISIBLE_MS = 4000;

interface Toast {
  id: number;
  message: string;
}

/**
 * Short confirmations ("Expense added"). They sit in a live region, so a
 * screen reader announces them without moving focus.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Set<number>());

  const notify = useCallback((message: string) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message }]);
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, VISIBLE_MS);
    timers.current.add(timer);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {toasts.map((toast) => (
          <p key={toast.id} className={styles.toast}>
            {toast.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
