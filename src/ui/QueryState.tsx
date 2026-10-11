import type { ReactNode } from 'react';

import { ErrorState, LoadingState } from './States';

/** The parts of a TanStack Query result this component reads. */
interface QueryLike<T> {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data: T | undefined;
  refetch: () => unknown;
}

interface QueryStateProps<T> {
  query: QueryLike<T>;
  /** What failed, in a few words: "Could not load the trend". */
  errorTitle: string;
  /** How many skeleton lines to show while loading. */
  rows?: number;
  children: (data: T) => ReactNode;
}

/** Loading, error or data for one query, so every region handles all three the same way. */
export function QueryState<T>({ query, errorTitle, rows = 4, children }: QueryStateProps<T>) {
  if (query.isError) {
    return (
      <ErrorState title={errorTitle} error={query.error} onRetry={() => void query.refetch()} />
    );
  }
  if (query.isPending || query.data === undefined) return <LoadingState rows={rows} />;
  return <>{children(query.data)}</>;
}
