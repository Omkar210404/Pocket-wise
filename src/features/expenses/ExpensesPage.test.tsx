import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { writeSession } from '@/auth/tokenStore';
import { currentLocation, renderApp } from '@/test/render';
import { API_URL, db, demoUserId, server, signIn } from '@/test/server';

const PAGING = { page: 1, page_size: 20, sort: 'date', order: 'desc' } as const;

/** How many expenses the seeded demo account has that match `filters`. */
const countInDb = (filters = {}) => db().listExpenses(demoUserId(), filters, PAGING).total;

/** The data rows of the expense table, without the header row. */
async function tableRows() {
  const table = await screen.findByRole('table', { name: 'Expenses' });
  return within(table).getAllByRole('row').slice(1);
}

/** Every request the app makes to a path, as URLs. */
function recordRequests(pathname: string) {
  const urls: URL[] = [];
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname === pathname) urls.push(url);
  });
  return urls;
}

describe('expense list', () => {
  it('shows a loading state, then the first page, newest first', async () => {
    signIn();
    renderApp('/expenses');

    expect(await screen.findByText('Loading expenses…')).toBeInTheDocument();

    const rows = await tableRows();
    const total = countInDb();
    expect(rows).toHaveLength(20);
    expect(screen.getByText(`${total} expenses in all.`)).toBeInTheDocument();
    expect(screen.getByText(`1–20 of ${total}`)).toBeInTheDocument();
    expect(screen.queryByText('Loading expenses…')).not.toBeInTheDocument();
  });

  it('moves through pages and keeps the page in the URL', async () => {
    signIn();
    const { user } = renderApp('/expenses');
    await tableRows();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText(`21–40 of ${countInDb()}`)).toBeInTheDocument();
    expect(currentLocation()).toBe('/expenses?page=2');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
  });

  it('sorts by amount when the column header is pressed', async () => {
    signIn();
    const { user } = renderApp('/expenses');
    await tableRows();

    await user.click(screen.getByRole('button', { name: /Amount/ }));

    await waitFor(() => expect(currentLocation()).toBe('/expenses?sort=amount&order=desc'));
    // The largest expenses in the seed are the monthly rent.
    await waitFor(async () =>
      expect((await tableRows())[0]).toHaveTextContent('Rent for the flat'),
    );
    expect(screen.getByRole('columnheader', { name: /Amount/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });
});

describe('filters', () => {
  it('searches notes after typing pauses, with one request, not one per key', async () => {
    signIn();
    const { user } = renderApp('/expenses');
    await tableRows();
    const requests = recordRequests('/expenses');

    await user.type(screen.getByLabelText('Search notes'), 'rent');
    // Nothing is sent while the keys are still going down.
    expect(currentLocation()).toBe('/expenses');

    await waitFor(() => expect(currentLocation()).toBe('/expenses?q=rent'));
    const matches = countInDb({ search: 'rent' });
    expect(await screen.findByText(`${matches} expenses match the filters.`)).toBeInTheDocument();
    for (const row of await tableRows()) expect(row).toHaveTextContent('Rent for the flat');
    expect(requests.map((url) => url.searchParams.get('q'))).toEqual(['rent']);
    server.events.removeAllListeners();
  });

  it('filters by category, date range and payment method together', async () => {
    signIn();
    const { user } = renderApp('/expenses');
    await tableRows();
    const food = db()
      .listCategories(demoUserId())
      .find((category) => category.name === 'Food')!;

    await user.selectOptions(screen.getByLabelText('Category'), 'Food');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-06-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-06-15' } });
    await user.selectOptions(screen.getByLabelText('Paid by'), 'UPI');

    const expected = countInDb({
      category_id: food.id,
      date_from: '2026-06-01',
      date_to: '2026-06-15',
      payment_method: 'upi',
    });
    expect(expected).toBeGreaterThan(0);
    expect(
      await screen.findByText(new RegExp(`^${expected} expenses? match(es)? the filters\\.$`)),
    ).toBeInTheDocument();
    for (const row of await tableRows()) {
      expect(row).toHaveTextContent('Food');
      expect(row).toHaveTextContent('UPI');
      // The day and month order depends on the reader's locale; the month does not.
      expect(row).toHaveTextContent(/Jun/);
    }
  });

  it('filters by an amount range', async () => {
    signIn();
    renderApp('/expenses?min=18000&max=19000');

    const matches = countInDb({ min_minor: 1_800_000, max_minor: 1_900_000 });
    expect(await screen.findByText(`${matches} expenses match the filters.`)).toBeInTheDocument();
    for (const row of await tableRows()) expect(row).toHaveTextContent('18,500.00');
  });

  it('names a reversed date range and sends no request for it', async () => {
    signIn();
    const requests = recordRequests('/expenses');
    renderApp('/expenses?from=2026-06-10&to=2026-06-01');

    expect(await screen.findByText('Fix the filters to see expenses.')).toBeInTheDocument();
    expect(screen.getByLabelText('From')).toHaveAccessibleDescription(
      'The start date is after the end date.',
    );
    expect(screen.getByLabelText('From')).toBeInvalid();
    expect(requests).toHaveLength(0);
    server.events.removeAllListeners();
  });

  it('says so when nothing matches, and can clear the filters from there', async () => {
    signIn();
    const { user } = renderApp('/expenses?q=zzzz&method=cash');

    expect(await screen.findByText('Nothing matches these filters.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();

    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!);

    expect(await tableRows()).toHaveLength(20);
    expect(currentLocation()).toBe('/expenses');
    expect(screen.getByLabelText('Search notes')).toHaveValue('');
  });
});

describe('empty and error states', () => {
  it('invites a new account to add its first expense', async () => {
    db().register('empty@example.com', 'a long passphrase');
    const token = db().login('empty@example.com', 'a long passphrase');
    writeSession({ token: token.access_token, expiresAt: Date.now() + 60_000 });
    renderApp('/expenses');

    expect(await screen.findByText('No expenses yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add your first expense' })).toBeInTheDocument();
  });

  it("shows the API's message and recovers on Try again", async () => {
    signIn();
    server.use(
      http.get(`${API_URL}/expenses`, () =>
        HttpResponse.json(
          { error: { code: 'internal_error', message: 'Internal server error' } },
          { status: 500 },
        ),
      ),
    );
    const { user } = renderApp('/expenses');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load expenses');
    expect(alert).toHaveTextContent('Internal server error');

    // The server is healthy again.
    server.resetHandlers();
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));

    expect(await tableRows()).toHaveLength(20);
  });
});

describe('add, edit and delete', () => {
  async function openAddPanel(user: ReturnType<typeof renderApp>['user']) {
    await tableRows();
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add expense' });
    await within(dialog).findByLabelText(/^Amount/);
    return within(dialog);
  }

  it('checks the form and marks each field that needs fixing', async () => {
    signIn();
    const requests = recordRequests('/expenses');
    const { user } = renderApp('/expenses');
    const panel = await openAddPanel(user);
    requests.length = 0;

    await user.click(panel.getByRole('button', { name: 'Add expense' }));

    expect(panel.getByLabelText(/^Amount/)).toHaveAccessibleDescription('Enter an amount.');
    expect(panel.getByLabelText('Category')).toHaveAccessibleDescription('Choose a category.');
    expect(requests).toHaveLength(0);
    server.events.removeAllListeners();
  });

  it('adds an expense and shows it at the top of the list', async () => {
    signIn();
    const before = countInDb();
    const { user } = renderApp('/expenses');
    const panel = await openAddPanel(user);

    await user.type(panel.getByLabelText(/^Amount/), '321.75');
    await user.selectOptions(panel.getByLabelText('Category'), 'Food');
    await user.type(panel.getByLabelText(/^Note/), 'Team lunch');
    await user.click(panel.getByRole('button', { name: 'Add expense' }));

    expect(await screen.findByText('Expense added')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(async () => expect((await tableRows())[0]).toHaveTextContent('Team lunch'));
    expect((await tableRows())[0]).toHaveTextContent('321.75');
    expect(screen.getByText(`${before + 1} expenses in all.`)).toBeInTheDocument();

    const saved = db().listExpenses(demoUserId(), { search: 'Team lunch' }, PAGING).items[0];
    expect(saved).toMatchObject({
      amount: '321.75',
      category_name: 'Food',
      date: '2026-06-15',
      payment_method: 'upi',
    });
  });

  it("puts the API's validation message under the field it is about", async () => {
    signIn();
    server.use(
      http.post(`${API_URL}/expenses`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'validation_error',
              message: 'Request validation failed',
              details: [{ field: 'body.category_id', message: 'Category not found' }],
            },
          },
          { status: 422 },
        ),
      ),
    );
    const { user } = renderApp('/expenses');
    const panel = await openAddPanel(user);

    await user.type(panel.getByLabelText(/^Amount/), '10');
    await user.selectOptions(panel.getByLabelText('Category'), 'Food');
    await user.click(panel.getByRole('button', { name: 'Add expense' }));

    await waitFor(() =>
      expect(panel.getByLabelText('Category')).toHaveAccessibleDescription('Category not found'),
    );
    // The panel stays open so the entry is not lost.
    expect(screen.getByRole('dialog', { name: 'Add expense' })).toBeInTheDocument();
  });

  it('shows an error that is not about a field above the form', async () => {
    signIn();
    server.use(http.post(`${API_URL}/expenses`, () => HttpResponse.error()));
    const { user } = renderApp('/expenses');
    const panel = await openAddPanel(user);

    await user.type(panel.getByLabelText(/^Amount/), '10');
    await user.selectOptions(panel.getByLabelText('Category'), 'Food');
    await user.click(panel.getByRole('button', { name: 'Add expense' }));

    expect(await panel.findByRole('alert')).toHaveTextContent('Could not reach the server.');
  });

  it('edits an expense, sending only the field that changed', async () => {
    signIn();
    let sent: unknown = null;
    server.use(
      // Records the body, then lets the normal handler answer.
      http.patch(`${API_URL}/expenses/:id`, async ({ request }) => {
        sent = await request.clone().json();
      }),
    );
    const { user } = renderApp('/expenses');
    await tableRows();

    await user.click(screen.getAllByRole('button', { name: /^Edit / })[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Edit expense' });
    const amount = await within(dialog).findByLabelText(/^Amount/);
    await user.clear(amount);
    await user.type(amount, '999');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Expense updated')).toBeInTheDocument();
    expect(sent).toEqual({ amount: '999.00' });
    await waitFor(async () => expect((await tableRows())[0]).toHaveTextContent('999.00'));
  });

  it('deletes an expense only after confirming', async () => {
    signIn();
    const before = countInDb();
    const { user } = renderApp('/expenses');
    const firstRow = (await tableRows())[0]!;
    const note = within(firstRow).getAllByRole('cell')[1]!.textContent;

    await user.click(within(firstRow).getByRole('button', { name: /^Delete / }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this expense?' });
    expect(dialog).toHaveTextContent(note);
    expect(dialog).toHaveTextContent('This cannot be undone.');
    expect(countInDb()).toBe(before);

    await user.click(within(dialog).getByRole('button', { name: 'Delete expense' }));

    expect(await screen.findByText('Expense deleted')).toBeInTheDocument();
    expect(await screen.findByText(`${before - 1} expenses in all.`)).toBeInTheDocument();
    expect(countInDb()).toBe(before - 1);
  });

  it('keeps the expense when the confirmation is declined', async () => {
    signIn();
    const before = countInDb();
    const { user } = renderApp('/expenses');
    await tableRows();

    await user.click(screen.getAllByRole('button', { name: /^Delete / })[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Delete this expense?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep it' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(countInDb()).toBe(before);
  });
});

describe('CSV export', () => {
  it('asks for the filtered expenses and hands the file to the browser', async () => {
    signIn();
    const createObjectURL = vi.fn((file: Blob) => (file ? 'blob:expenses' : ''));
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const requests = recordRequests('/expenses/export');
    const { user } = renderApp('/expenses?q=auto&method=cash');
    await tableRows();

    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    const matches = countInDb({ search: 'auto', payment_method: 'cash' });
    expect(
      await screen.findByText(`Exported ${matches} expenses to expenses.csv`),
    ).toBeInTheDocument();
    // The same filters as the list, and no paging: the file holds every match.
    expect(Object.fromEntries(requests[0]!.searchParams)).toEqual({
      q: 'auto',
      payment_method: 'cash',
    });
    const file = createObjectURL.mock.calls[0]![0];
    expect(await file.text()).toMatch(/^id,date,amount,category,payment_method,note\r\n/);
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('expenses.csv');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:expenses');
    server.events.removeAllListeners();
  });

  it('says so when the export fails', async () => {
    signIn();
    server.use(http.get(`${API_URL}/expenses/export`, () => HttpResponse.error()));
    const { user } = renderApp('/expenses');
    await tableRows();

    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(
      await screen.findByText(/^Export failed\. Could not reach the server\./),
    ).toBeInTheDocument();
  });
});
