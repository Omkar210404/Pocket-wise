import type { QueryClient } from '@tanstack/react-query';

import type { ExpenseListParams, IsoDate, IsoMonth } from './types';

/** Every query key in one place, so invalidation cannot miss one. */
export const queryKeys = {
  me: ['me'] as const,
  categories: ['categories'] as const,
  expenses: (params: ExpenseListParams) => ['expenses', params] as const,
  budgetStatus: (month: IsoMonth) => ['budgets', 'status', month] as const,
  categorySummary: (from: IsoDate, to: IsoDate) => ['summary', 'categories', from, to] as const,
  trends: (months: number) => ['summary', 'trends', months] as const,
};

/**
 * One changed expense or budget changes the list, the budget status and the
 * summaries together, so they are always refreshed as a group.
 */
export function invalidateMoneyData(queryClient: QueryClient): Promise<unknown> {
  return Promise.all(
    (['expenses', 'budgets', 'summary'] as const).map((root) =>
      queryClient.invalidateQueries({ queryKey: [root] }),
    ),
  );
}
