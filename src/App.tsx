import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { createQueryClient } from '@/api/queryClient';
import { apiUrl } from '@/env';
import { ConfigError } from '@/layout/ConfigError';

import { AppRoutes } from './AppRoutes';
import { Providers } from './Providers';

export function App() {
  const [queryClient] = useState(createQueryClient);

  // Normal mode with no API address: say so plainly instead of failing on the first request.
  if (!apiUrl) return <ConfigError />;

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Providers>
          <AppRoutes />
        </Providers>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
