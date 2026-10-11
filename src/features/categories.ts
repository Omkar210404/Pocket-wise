import { useQuery } from '@tanstack/react-query';

import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';

/** The user's categories, sorted by name. They change rarely, so they stay fresh for a while. */
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: ({ signal }) => api.categories.list(signal),
    staleTime: 5 * 60_000,
  });
}
