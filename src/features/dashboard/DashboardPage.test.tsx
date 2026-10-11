import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { writeSession } from '@/auth/tokenStore';
import { formatMoney } from '@/lib/money';
import { renderApp } from '@/test/render';
import { API_URL, db, demoUserId, server, signIn, TEST_MONTH } from '@/test/server';

const statusInDb = () => db().budgetStatus(demoUserId(), TEST_MONTH);

/** The dashboard section with the given heading. */
async function section(title: string) {
  const heading = await screen.findByRole('heading', { name: title });
  return within(heading.closest('section')!);
}

describe('dashboard', () => {
  it("leads with this month's total, exactly as the API reports it", async () => {
    signIn();
    renderApp('/');
    const status = statusInDb();

    expect(await screen.findByRole('heading', { name: 'June 2026', level: 1 })).toBeInTheDocument();
    const label = await screen.findByText('Spent in June');
    expect(label.parentElement).toHaveTextContent(formatMoney(status.total_spent));
  });

  it('shows how much of the total budget is used', async () => {
    signIn();
    renderApp('/');
    const { totals } = statusInDb();

    const label = await screen.findByText('Budget used');
    const cell = within(label.parentElement!);
    expect(cell.getByText(`${totals.percent_used}%`)).toBeInTheDocument();
    expect(cell.getByRole('progressbar', { name: 'All budgets together' })).toHaveAttribute(
      'aria-valuetext',
      `${totals.percent_used}% used`,
    );
  });

  it('lists spent against budget per category, with over-budget said in words', async () => {
    signIn();
    renderApp('/');
    const status = statusInDb();
    const progress = await section('Spent against budget');

    for (const item of status.items) {
      expect(
        progress.getByRole('progressbar', { name: `${item.category_name} budget` }),
      ).toBeInTheDocument();
    }
    const over = status.items.filter((item) => item.over_budget);
    expect(over.length).toBeGreaterThan(0);
    expect(progress.getAllByText(/^Over by/)).toHaveLength(over.length);

    // Spending in categories without a budget is listed, not hidden.
    for (const item of status.unbudgeted) {
      expect(progress.getByText(item.category_name)).toBeInTheDocument();
    }
    expect(status.unbudgeted.length).toBeGreaterThan(0);
  });

  it('offers the monthly trend as a table with the same numbers', async () => {
    signIn();
    const { user } = renderApp('/');
    const trend = await section('Monthly spending');
    const months = db().trends(demoUserId(), 6).months;

    await user.click(trend.getByRole('button', { name: 'Show table' }));

    const rows = trend.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toHaveTextContent('January 2026');
    expect(rows[5]).toHaveTextContent('June 2026 (so far)');
    months.forEach((month, index) => {
      expect(rows[index]).toHaveTextContent(formatMoney(month.total));
    });
    expect(trend.getByRole('button', { name: 'Show chart' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('offers the category breakdown as a table, largest first', async () => {
    signIn();
    const { user } = renderApp('/');
    const breakdown = await section('Where it went');
    const categories = db().categorySummary(demoUserId(), '2026-06-01', '2026-06-30').categories;

    await user.click(breakdown.getByRole('button', { name: 'Show table' }));

    const rows = breakdown.getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual(
      categories.map((category) => category.category_name),
    );
    expect(rows[0]).toHaveTextContent(`${categories[0]!.share}%`);
  });

  it('lists the five latest expenses', async () => {
    signIn();
    renderApp('/');
    const recent = await section('Recent expenses');

    await waitFor(() => expect(recent.getAllByRole('listitem')).toHaveLength(5));
    expect(recent.getByRole('link', { name: 'All expenses' })).toHaveAttribute('href', '/expenses');
  });

  it('adds an expense from the dashboard and updates the total', async () => {
    signIn();
    const before = statusInDb().total_spent;
    const { user } = renderApp('/');
    await screen.findByText('Spent in June');

    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Add expense' }));
    await user.type(await dialog.findByLabelText(/^Amount/), '1000');
    await user.selectOptions(dialog.getByLabelText('Category'), 'Food');
    await user.click(dialog.getByRole('button', { name: 'Add expense' }));

    expect(await screen.findByText('Expense added')).toBeInTheDocument();
    const after = statusInDb().total_spent;
    expect(Number(after) - Number(before)).toBe(1000);
    await waitFor(() =>
      expect(screen.getByText('Spent in June').parentElement).toHaveTextContent(formatMoney(after)),
    );
  });
});

describe('dashboard states', () => {
  it('shows an error in the one region that failed and keeps the rest working', async () => {
    signIn();
    server.use(
      http.get(`${API_URL}/summary/trends`, () =>
        HttpResponse.json(
          { error: { code: 'internal_error', message: 'Internal server error' } },
          { status: 500 },
        ),
      ),
    );
    const { user } = renderApp('/');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load the monthly trend');
    expect(alert).toHaveTextContent('Internal server error');
    // The other regions are unaffected.
    expect(await screen.findByText('Spent in June')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Where it went' })).toBeInTheDocument();

    server.resetHandlers();
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Monthly spending' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('explains every empty region for an account with no data', async () => {
    db().register('empty@example.com', 'a long passphrase');
    const token = db().login('empty@example.com', 'a long passphrase');
    writeSession({ token: token.access_token, expiresAt: Date.now() + 60_000 });
    renderApp('/');

    expect(await screen.findByText('No expenses yet this month.')).toBeInTheDocument();
    expect(await screen.findByText('No budgets')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set budgets' })).toHaveAttribute('href', '/budgets');
    expect(await screen.findByText('Nothing to chart yet.')).toBeInTheDocument();
    expect(await screen.findByText('No spending in June yet.')).toBeInTheDocument();
    expect(await screen.findByText('No budgets or spending in June yet.')).toBeInTheDocument();
    expect(await screen.findByText('No expenses yet.')).toBeInTheDocument();
  });
});
