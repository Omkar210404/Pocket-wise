import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/api/endpoints';
import { invalidateMoneyData, queryKeys } from '@/api/queryKeys';
import type { ExpenseCreate, ExpenseListParams, ExpenseUpdate } from '@/api/types';

/** One page of expenses. Pass null to ask for nothing (a filter has a problem). */
export function useExpenses(params: ExpenseListParams | null) {
  return useQuery({
    queryKey: queryKeys.expenses(params ?? {}),
    queryFn: ({ signal }) => api.expenses.list(params ?? {}, signal),
    enabled: params !== null,
    // While the next page or filter loads, the previous rows stay on screen.
    placeholderData: keepPreviousData,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ExpenseCreate) => api.expenses.create(data),
    onSuccess: () => invalidateMoneyData(queryClient),
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: ExpenseUpdate }) =>
      api.expenses.update(id, changes),
    onSuccess: () => invalidateMoneyData(queryClient),
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.expenses.remove(id),
    onSuccess: () => invalidateMoneyData(queryClient),
  });
}
