import { useQuery } from '@tanstack/react-query';

import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { ExpenseListParams } from '@/api/types';
import { monthBounds } from '@/lib/dates';

export const TREND_MONTHS = 6;

const RECENT: ExpenseListParams = { page: 1, page_size: 5, sort: 'date', order: 'desc' };

export function useTrends() {
  return useQuery({
    queryKey: queryKeys.trends(TREND_MONTHS),
    queryFn: ({ signal }) => api.summary.trends(TREND_MONTHS, signal),
  });
}

/** Total per category for one month. */
export function useCategorySummary(month: string) {
  const [from, to] = monthBounds(month);
  return useQuery({
    queryKey: queryKeys.categorySummary(from, to),
    queryFn: ({ signal }) => api.summary.categories({ date_from: from, date_to: to }, signal),
  });
}

/** The five latest expenses. */
export function useRecentExpenses() {
  return useQuery({
    queryKey: queryKeys.expenses(RECENT),
    queryFn: ({ signal }) => api.expenses.list(RECENT, signal),
  });
}
