import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { currentLocation, renderApp } from '@/test/render';
import { API_URL, db, demoUserId, server, signIn, TEST_MONTH } from '@/test/server';

/** The table row for one category, once the page has loaded. */
async function rowFor(category: string) {
  const table = await screen.findByRole('table', { name: /^Budgets for/ });
  return within(table).getByRole('row', { name: new RegExp(`^${category}\\b`) });
}

const budgetInput = (row: HTMLElement) => within(row).getByRole('textbox');
const statusInDb = (month = TEST_MONTH) => db().budgetStatus(demoUserId(), month);
const budgetInDb = (category: string, month = TEST_MONTH) =>
  statusInDb(month).items.find((item) => item.category_name === category);

/** Method and path of every budget request the app makes. */
function recordBudgetRequests() {
  const calls: string[] = [];
  server.events.on('request:start', ({ request }) => {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/budgets') && request.method !== 'GET') {
      calls.push(`${request.method} ${pathname}`);
    }
  });
  return calls;
}

describe('budgets page', () => {
  it('lists every category with its budget, spending and standing', async () => {
    signIn();
    renderApp('/budgets');

    const food = await rowFor('Food');
    const status = statusInDb();
    expect(budgetInput(food)).toHaveValue('9000.00');
    expect(food).toHaveTextContent(`${budgetInDb('Food')!.percent_used}%`);

    // The seed puts Entertainment over its budget and leaves Health without one.
    expect(await rowFor('Entertainment')).toHaveTextContent(/Over by/);
    const health = await rowFor('Health');
    expect(budgetInput(health)).toHaveValue('');
    expect(health).toHaveTextContent('No budget this month');

    const table = screen.getByRole('table', { name: /^Budgets for/ });
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 9);
    expect(screen.getByText('Budgeted').nextElementSibling).toHaveTextContent('39,200.00');
    expect(screen.getByText('Spent without a budget').nextElementSibling).toHaveTextContent(
      Number(status.unbudgeted_spent).toLocaleString(undefined, { minimumFractionDigits: 2 }),
    );
  });

  it('creates a budget with POST for a category that has none', async () => {
    signIn();
    const calls = recordBudgetRequests();
    const { user } = renderApp('/budgets');
    const health = await rowFor('Health');
    expect(within(health).getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.type(budgetInput(health), '500');
    await user.click(within(health).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/^Health budget set to .*500\.00$/)).toBeInTheDocument();
    expect(calls).toEqual(['POST /budgets']);
    await waitFor(async () => expect(budgetInput(await rowFor('Health'))).toHaveValue('500.00'));
    expect(budgetInDb('Health')).toMatchObject({ budget: '500.00' });
    server.events.removeAllListeners();
  });

  it('changes an existing budget with PATCH, never a second POST', async () => {
    signIn();
    const calls = recordBudgetRequests();
    const existing = budgetInDb('Food')!;
    const { user } = renderApp('/budgets');
    const food = await rowFor('Food');

    await user.clear(budgetInput(food));
    // Enter saves, like the Save button.
    await user.type(budgetInput(food), '10000{Enter}');

    expect(await screen.findByText(/^Food budget set to/)).toBeInTheDocument();
    expect(calls).toEqual([`PATCH /budgets/${existing.budget_id}`]);
    expect(budgetInDb('Food')).toMatchObject({ budget: '10000.00', budget_id: existing.budget_id });
    server.events.removeAllListeners();
  });

  it('rejects an amount that is not a positive number, without a request', async () => {
    signIn();
    const calls = recordBudgetRequests();
    const { user } = renderApp('/budgets');
    const food = await rowFor('Food');

    await user.clear(budgetInput(food));
    await user.type(budgetInput(food), 'lots{Enter}');

    expect(within(food).getByRole('alert')).toHaveTextContent(
      'Enter a number, for example 249.50.',
    );
    expect(budgetInput(food)).toBeInvalid();
    expect(calls).toEqual([]);
    expect(budgetInDb('Food')).toMatchObject({ budget: '9000.00' });
    server.events.removeAllListeners();
  });

  it('removes a budget with DELETE', async () => {
    signIn();
    const calls = recordBudgetRequests();
    const existing = budgetInDb('Food')!;
    const { user } = renderApp('/budgets');
    const food = await rowFor('Food');

    await user.click(within(food).getByRole('button', { name: 'Remove the Food budget' }));

    expect(await screen.findByText('Food budget removed')).toBeInTheDocument();
    expect(calls).toEqual([`DELETE /budgets/${existing.budget_id}`]);
    await waitFor(async () =>
      expect(await rowFor('Food')).toHaveTextContent('No budget this month'),
    );
    expect(budgetInDb('Food')).toBeUndefined();
    server.events.removeAllListeners();
  });

  it("shows the API's conflict message in the row when the budget already exists", async () => {
    signIn();
    server.use(
      http.post(`${API_URL}/budgets`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'conflict',
              message: "A budget for 'Health' in 2026-06 already exists. Change it instead.",
            },
          },
          { status: 409 },
        ),
      ),
    );
    const { user } = renderApp('/budgets');
    const health = await rowFor('Health');

    await user.type(budgetInput(health), '500{Enter}');

    expect(await within(health).findByRole('alert')).toHaveTextContent(
      "A budget for 'Health' in 2026-06 already exists. Change it instead.",
    );
  });

  it('shows an error state with a retry when the budgets cannot be loaded', async () => {
    signIn();
    server.use(
      http.get(`${API_URL}/budgets/status`, () =>
        HttpResponse.json(
          { error: { code: 'internal_error', message: 'Internal server error' } },
          { status: 500 },
        ),
      ),
    );
    const { user } = renderApp('/budgets');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load budgets');
    expect(alert).toHaveTextContent('Internal server error');

    server.resetHandlers();
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));

    expect(await rowFor('Food')).toBeInTheDocument();
  });
});

describe('months', () => {
  it('steps to another month and keeps it in the URL', async () => {
    signIn();
    const { user } = renderApp('/budgets');
    await rowFor('Food');

    await user.click(screen.getByRole('button', { name: 'Previous month, May 2026' }));

    await waitFor(() => expect(currentLocation()).toBe('/budgets?month=2026-05'));
    expect(await screen.findByRole('table', { name: 'Budgets for May 2026' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'This month' }));
    await waitFor(() => expect(currentLocation()).toBe('/budgets'));
  });

  it("offers to copy last month's budgets into a month that has none", async () => {
    signIn();
    const { user } = renderApp('/budgets?month=2026-07');
    expect(statusInDb('2026-07').items).toHaveLength(0);

    await user.click(await screen.findByRole('button', { name: 'Copy 6 budgets from June 2026' }));

    expect(await screen.findByText('Copied 6 budgets to July 2026')).toBeInTheDocument();
    await waitFor(async () => expect(budgetInput(await rowFor('Food'))).toHaveValue('9000.00'));
    expect(statusInDb('2026-07').items.map((item) => item.budget)).toEqual(
      statusInDb('2026-06').items.map((item) => item.budget),
    );
    // Once the month has budgets, the offer is gone.
    expect(screen.queryByRole('button', { name: /^Copy/ })).not.toBeInTheDocument();
  });
});
