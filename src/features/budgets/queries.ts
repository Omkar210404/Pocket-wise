import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/endpoints';
import { invalidateMoneyData, queryKeys } from '@/api/queryKeys';
import type { Amount, IsoMonth } from '@/api/types';

/** Spent vs budget for one month. Pass `enabled: false` to hold the request back. */
export function useBudgetStatus(month: IsoMonth, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.budgetStatus(month),
    queryFn: ({ signal }) => api.budgets.status(month, signal),
    enabled,
  });
}

interface SaveBudgetInput {
  category_id: number;
  /** The existing budget's id, or null when the category has none this month. */
  budget_id: number | null;
  amount: Amount;
}

/**
 * Sets a category's budget for the month. The API refuses a second budget for
 * the same category and month with a 409, so an existing one is changed with
 * PATCH and only a missing one is created with POST.
 */
export function useSaveBudget(month: IsoMonth) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ category_id, budget_id, amount }: SaveBudgetInput) =>
      budget_id === null
        ? api.budgets.create({ category_id, month, amount })
        : api.budgets.update(budget_id, { amount }),
    // Also after a failure: a 409 means the page was showing stale budgets.
    onSettled: () => invalidateMoneyData(queryClient),
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (budgetId: number) => api.budgets.remove(budgetId),
    onSettled: () => invalidateMoneyData(queryClient),
  });
}

/** Creates several budgets in the month, one after another. */
export function useCopyBudgets(month: IsoMonth) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (budgets: { category_id: number; amount: Amount }[]) => {
      for (const budget of budgets) {
        await api.budgets.create({ ...budget, month });
      }
      return budgets.length;
    },
    onSettled: () => invalidateMoneyData(queryClient),
  });
}
