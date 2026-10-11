import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { AppRoutes } from '@/AppRoutes';
import { Providers } from '@/Providers';

/** Shows the router's current address, so a test can assert on navigation. */
function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname + location.search}</span>;
}

/** The whole app at `route`, against the fake API, with a fresh cache and no retries. */
export function renderApp(route = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Providers>
          <AppRoutes />
          <LocationProbe />
        </Providers>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, user: userEvent.setup(), queryClient };
}

/** The address the app is currently at, for example "/expenses?page=2". */
export function currentLocation(): string {
  return document.querySelector('[data-testid="location"]')?.textContent ?? '';
}
