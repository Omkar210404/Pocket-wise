import type { ReactNode } from 'react';

import { errorMessage } from '@/api/errors';

import { Button } from './Button';
import styles from './States.module.css';

/** Skeleton rules in the shape of the content. No spinner. */
export function LoadingState({ rows = 4, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div className={styles.loading} role="status">
      <span className="visually-hidden">{label}…</span>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className={styles.skeleton}
          style={{ width: `${92 - ((index * 17) % 40)}%` }}
        />
      ))}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  children?: ReactNode;
  /** The one action that fixes the emptiness. */
  action?: ReactNode;
}

export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <div className={styles.state}>
      <p className={styles.title}>{title}</p>
      {children && <p className={styles.text}>{children}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  /** What failed, in a few words: "Could not load expenses". */
  title: string;
  error: unknown;
  onRetry?: () => void;
}

export function ErrorState({ title, error, onRetry }: ErrorStateProps) {
  return (
    <div className={`${styles.state} ${styles.error}`} role="alert">
      <p className={styles.title}>{title}</p>
      <p className={styles.text}>{errorMessage(error)}</p>
      {onRetry && (
        <div className={styles.action}>
          <Button small onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

/** A one-line error above or inside a form. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className={styles.note} role="alert">
      {children}
    </p>
  );
}
