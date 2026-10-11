/**
 * Contract check: does the demo layer answer like the real Expense-Tracker-API?
 *
 * The same sequence of requests is sent to the demo handlers and to a real,
 * freshly migrated API, and the answers are compared: status, body and, for the
 * export, the CSV text. Only values that cannot match are masked (tokens,
 * timestamps and the configured token lifetime).
 *
 * It needs a running backend with an EMPTY database, so it is skipped unless
 * VITE_REAL_API_URL is set:
 *
 *   VITE_REAL_API_URL=http://127.0.0.1:8000 npm run test:contract
 */

import { http, passthrough } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addMonths, currentMonth, todayIso } from '@/lib/dates';
import { API_URL, server } from '@/test/server';

import { DemoDb } from './db';
import { createHandlers } from './handlers';

const REAL_API_URL = import.meta.env.VITE_REAL_API_URL?.replace(/\/+$/, '');

interface Step {
  label: string;
  status: number;
  body: unknown;
}

// `expires_in` is the server's ACCESS_TOKEN_EXPIRE_MINUTES setting, not part of the contract.
const MASKED = new Set(['access_token', 'created_at', 'updated_at', 'expires_in']);

/** Replaces the values that differ between any two servers with a placeholder. */
function mask(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(mask);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        MASKED.has(key) ? `<${key}>` : mask(inner),
      ]),
    );
  }
  return value;
}

/** Runs the scenario against one server and records every answer. */
async function runScenario(base: string): Promise<Step[]> {
  const steps: Step[] = [];
  let token = '';

  async function call(
    label: string,
    method: string,
    path: string,
    options: { json?: unknown; form?: Record<string, string>; auth?: boolean } = {},
  ): Promise<unknown> {
    const headers: Record<string, string> = {};
    if (options.auth !== false && token) headers.Authorization = `Bearer ${token}`;
    let body: BodyInit | undefined;
    if (options.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.json);
    } else if (options.form) {
      body = new URLSearchParams(options.form);
    }
    const response = await fetch(`${base}${path}`, { method, headers, body });
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = text === '' ? null : JSON.parse(text);
    } catch {
      // Not JSON: the CSV export.
    }
    steps.push({ label, status: response.status, body: mask(parsed) });
    return parsed;
  }

  const user = { email: 'contract@example.com', password: 'a long passphrase' };
  const month = currentMonth();
  const today = todayIso();
  const lastMonth = addMonths(month, -1);

  // ---- auth ----
  await call('register', 'POST', '/auth/register', { json: user, auth: false });
  await call('register again: 409', 'POST', '/auth/register', { json: user, auth: false });
  await call('register, short password: 422', 'POST', '/auth/register', {
    json: { email: 'other@example.com', password: 'short' },
    auth: false,
  });
  await call('login, wrong password: 401', 'POST', '/auth/login', {
    form: { username: user.email, password: 'not the password' },
    auth: false,
  });
  await call('me without a token: 401', 'GET', '/auth/me', { auth: false });
  const login = (await call('login', 'POST', '/auth/login', {
    form: { username: user.email, password: user.password },
    auth: false,
  })) as { access_token: string };
  token = login.access_token;
  await call('me', 'GET', '/auth/me');

  // ---- categories ----
  const categories = (await call('categories', 'GET', '/categories')) as {
    id: number;
    name: string;
  }[];
  const id = (name: string) => categories.find((category) => category.name === name)?.id ?? 0;

  // ---- expenses ----
  const expense = (amount: string, category: string, date: string, note: string | null) => ({
    amount,
    category_id: id(category),
    date,
    note,
    payment_method: 'upi',
  });
  await call('create expense', 'POST', '/expenses', {
    json: expense('249.50', 'Food', `${month}-01`, '  Lunch with the team  '),
  });
  await call('create expense, number amount', 'POST', '/expenses', {
    json: { ...expense('0', 'Transport', `${month}-01`, null), amount: 120.5 },
  });
  await call('create expense, formula note', 'POST', '/expenses', {
    json: expense('1000.00', 'Health', `${lastMonth}-15`, '=SUM(A1:A9), "quoted"'),
  });
  await call('create expense, blank note', 'POST', '/expenses', {
    json: expense('75.25', 'Food', `${lastMonth}-20`, '   '),
  });
  await call('create expense, amount 0: 422', 'POST', '/expenses', {
    json: expense('0', 'Food', today, null),
  });
  await call('create expense, 3 decimals: 422', 'POST', '/expenses', {
    json: expense('1.234', 'Food', today, null),
  });
  await call('create expense, too large: 422', 'POST', '/expenses', {
    json: expense('10000000', 'Food', today, null),
  });
  await call('create expense, unknown category: 422', 'POST', '/expenses', {
    json: { ...expense('5.00', 'Food', today, null), category_id: 999_999 },
  });
  await call('create expense, far future: 422', 'POST', '/expenses', {
    json: expense('5.00', 'Food', '2099-01-01', null),
  });
  await call('create expense, before 2000: 422', 'POST', '/expenses', {
    json: expense('5.00', 'Food', '1999-12-31', null),
  });
  await call('create expense, bad method: 422', 'POST', '/expenses', {
    json: { ...expense('5.00', 'Food', today, null), payment_method: 'cheque' },
  });

  await call('list, default order', 'GET', '/expenses');
  await call(
    'list, by amount ascending, page size 2',
    'GET',
    '/expenses?sort=amount&order=asc&page_size=2',
  );
  await call('list, page 2', 'GET', '/expenses?sort=amount&order=asc&page_size=2&page=2');
  await call(
    'list, category and date range',
    'GET',
    `/expenses?category_id=${id('Food')}&date_from=${month}-01`,
  );
  await call('list, amount range', 'GET', '/expenses?min_amount=100&max_amount=300');
  await call('list, search', 'GET', '/expenses?q=LUNCH');
  await call('list, payment method', 'GET', '/expenses?payment_method=cash');
  await call(
    'list, reversed dates: 422',
    'GET',
    '/expenses?date_from=2026-02-10&date_to=2026-02-01',
  );
  await call('list, reversed amounts: 422', 'GET', '/expenses?min_amount=500&max_amount=100');
  await call('list, page size 101: 422', 'GET', '/expenses?page_size=101');
  await call('list, bad sort: 422', 'GET', '/expenses?sort=id');

  await call('update amount only', 'PATCH', '/expenses/1', { json: { amount: '300.00' } });
  await call('update, clear the note', 'PATCH', '/expenses/1', { json: { note: null } });
  await call('update, null amount: 422', 'PATCH', '/expenses/1', { json: { amount: null } });
  await call('update, missing expense: 404', 'PATCH', '/expenses/999999', {
    json: { amount: '1.00' },
  });
  await call('export', 'GET', '/expenses/export');
  await call('export, filtered', 'GET', `/expenses/export?date_to=${lastMonth}-28`);

  // ---- budgets ----
  await call('create budget', 'POST', '/budgets', {
    json: { category_id: id('Food'), month, amount: '1000.00' },
  });
  await call('create budget, small', 'POST', '/budgets', {
    json: { category_id: id('Transport'), month, amount: '100' },
  });
  await call('create budget again: 409', 'POST', '/budgets', {
    json: { category_id: id('Food'), month, amount: '500.00' },
  });
  await call('create budget, bad month: 422', 'POST', '/budgets', {
    json: { category_id: id('Food'), month: '2026-13', amount: '500.00' },
  });
  await call('budget status, this month', 'GET', `/budgets/status?month=${month}`);
  await call('budget status, last month (no budgets)', 'GET', `/budgets/status?month=${lastMonth}`);
  await call('budget status, no month: 422', 'GET', '/budgets/status');
  await call('update budget', 'PATCH', '/budgets/1', { json: { amount: '250.00' } });
  await call('budget status after update', 'GET', `/budgets/status?month=${month}`);
  await call('delete budget', 'DELETE', '/budgets/2');
  await call('delete budget again: 404', 'DELETE', '/budgets/2');

  // ---- summaries ----
  await call(
    'category summary, this month',
    'GET',
    `/summary/categories?date_from=${month}-01&date_to=${month}-28`,
  );
  await call('category summary, everything', 'GET', '/summary/categories');
  await call('trends, 3 months', 'GET', '/summary/trends?months=3');
  await call('trends, default', 'GET', '/summary/trends');
  await call('trends, 37 months: 422', 'GET', '/summary/trends?months=37');

  // ---- delete ----
  await call('delete expense', 'DELETE', '/expenses/2');
  await call('delete expense again: 404', 'DELETE', '/expenses/2');
  await call('list after delete', 'GET', '/expenses');

  return steps;
}

describe.skipIf(!REAL_API_URL)('demo layer vs the real API', () => {
  beforeEach(() => {
    // The real server lives in real time, so the demo must too.
    vi.useRealTimers();
  });

  it('gives the same answer to every request in the scenario', async () => {
    const real = REAL_API_URL!;
    server.resetHandlers(
      ...createHandlers(API_URL, new DemoDb()),
      http.all(`${real}/*`, () => passthrough()),
    );

    const fromDemo = await runScenario(API_URL);
    const fromReal = await runScenario(real);

    expect(fromDemo.length).toBe(fromReal.length);
    // Compared one by one, so a failure names the request that differs.
    const differences = fromReal.flatMap((expected, index) => {
      const actual = fromDemo[index]!;
      try {
        expect(actual).toEqual(expected);
        return [];
      } catch {
        return [{ request: expected.label, real: expected, demo: actual }];
      }
    });
    console.info(
      `Contract check: ${fromReal.length} requests compared, ${differences.length} differ.`,
    );
    expect(differences).toEqual([]);
  }, 60_000);
});
