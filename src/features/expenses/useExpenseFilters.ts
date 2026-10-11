import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { ExpenseSort } from '@/api/types';

import {
  checkFilters,
  countActiveFilters,
  FILTER_NAMES,
  parseListState,
  type FilterName,
} from './filters';

/** The expense list's filters, sorting and page, read from and written to the URL. */
export function useExpenseFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const state = useMemo(() => parseListState(searchParams), [searchParams]);
  const checked = useMemo(() => checkFilters(state), [state]);

  const update = useCallback(
    (change: (params: URLSearchParams) => void) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          change(next);
          return next;
        },
        // Typing in a filter should not add a history entry per keystroke.
        { replace: true },
      );
    },
    [setSearchParams],
  );

  /** Changing what is listed always goes back to the first page. */
  const setFilter = useCallback(
    (name: FilterName, value: string) => {
      update((params) => {
        if (value.trim()) params.set(name, value.trim());
        else params.delete(name);
        params.delete('page');
      });
    },
    [update],
  );

  const clearFilters = useCallback(() => {
    update((params) => {
      for (const name of FILTER_NAMES) params.delete(name);
      params.delete('page');
    });
  }, [update]);

  const setPage = useCallback(
    (page: number) => {
      update((params) => {
        if (page > 1) params.set('page', String(page));
        else params.delete('page');
      });
    },
    [update],
  );

  /** A new column starts with its largest or latest first. The same column again flips the order. */
  const toggleSort = useCallback(
    (sort: ExpenseSort) => {
      update((params) => {
        const sameColumn = (params.get('sort') ?? 'date') === sort;
        const order = sameColumn && params.get('order') !== 'asc' ? 'asc' : 'desc';
        params.set('sort', sort);
        params.set('order', order);
        params.delete('page');
      });
    },
    [update],
  );

  return {
    state,
    /** Filters ready for the API, or null while a filter has a problem. */
    filters: checked.filters,
    problems: checked.problems,
    activeCount: countActiveFilters(state),
    setFilter,
    clearFilters,
    setPage,
    toggleSort,
  };
}
