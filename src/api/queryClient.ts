import { QueryClient } from '@tanstack/react-query';

import { isApiError } from './errors';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // A 4xx is an answer, not a glitch: asking again gives the same answer.
        // Network failures and 5xx get one more try.
        retry: (failures, error) => {
          if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
          return failures < 1;
        },
      },
    },
  });
}
