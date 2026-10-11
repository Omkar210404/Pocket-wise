/**
 * DEMO DATA LAYER. Mock Service Worker handlers that answer the app's requests
 * from a `DemoDb`, with the same paths, status codes and bodies as the
 * Expense-Tracker-API. The app's real API client runs unchanged against them.
 * The same handlers serve demo mode in the browser and the tests in Node.
 */

import { delay, http, HttpResponse, type HttpHandler } from 'msw';

import { EXPENSE_SORTS, PAYMENT_METHODS, type PaymentMethod } from '@/api/types';
import { isIsoDate, isIsoMonth } from '@/lib/dates';
import { MAX_AMOUNT_MINOR } from '@/lib/money';

import { DemoError, invalid, type DemoDb, type DemoExpenseFilters } from './db';

const MAX_ID = 2 ** 31 - 1;

// ---- reading and checking request values, in the backend's words ----------

type Body = Record<string, unknown>;

async function jsonBody(request: Request): Promise<Body> {
  try {
    const body: unknown = await request.json();
    if (typeof body === 'object' && body !== null && !Array.isArray(body)) return body as Body;
  } catch {
    // Falls through to the error below.
  }
  throw invalid('body', 'Input should be a valid dictionary or object');
}

/** A decimal amount, sent as a number or a string, as whole minor units. */
function amountMinor(value: unknown, field: string, { allowZero = false } = {}): number {
  if (value === undefined || value === null) throw invalid(field, 'Field required');
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !/^\d+(\.\d+)?$/.test(text.trim())) {
    throw invalid(field, 'Input should be a valid decimal');
  }
  const [whole = '0', fraction = ''] = text.trim().split('.');
  if (fraction.length > 2) {
    throw invalid(field, 'Decimal input should have no more than 2 decimal places');
  }
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0') || '0');
  if (minor > MAX_AMOUNT_MINOR) {
    throw invalid(field, 'Input should be less than or equal to 9999999.99');
  }
  if (allowZero ? minor < 0 : minor <= 0) {
    throw invalid(
      field,
      allowZero ? 'Input should be greater than or equal to 0' : 'Input should be greater than 0',
    );
  }
  return minor;
}

function resourceId(value: unknown, field: string): number {
  if (value === undefined || value === null) throw invalid(field, 'Field required');
  const id = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof id !== 'number' || !Number.isInteger(id)) {
    throw invalid(field, 'Input should be a valid integer');
  }
  if (id < 1) throw invalid(field, 'Input should be greater than or equal to 1');
  if (id > MAX_ID) throw invalid(field, `Input should be less than or equal to ${MAX_ID}`);
  return id;
}

function isoDate(value: unknown, field: string): string {
  if (value === undefined || value === null) throw invalid(field, 'Field required');
  if (typeof value !== 'string' || !isIsoDate(value)) {
    throw invalid(field, 'Input should be a valid date in the format YYYY-MM-DD');
  }
  return value;
}

function isoMonth(value: unknown, field: string): string {
  if (value === undefined || value === null) throw invalid(field, 'Field required');
  if (typeof value !== 'string' || !isIsoMonth(value)) {
    throw invalid(field, 'Value error, Month must look like YYYY-MM, for example 2026-06');
  }
  return value;
}

function paymentMethod(value: unknown, field: string): PaymentMethod {
  if (value === undefined || value === null) throw invalid(field, 'Field required');
  if (!PAYMENT_METHODS.includes(value as PaymentMethod)) {
    throw invalid(
      field,
      "Input should be 'cash', 'card', 'upi', 'bank_transfer', 'wallet' or 'other'",
    );
  }
  return value as PaymentMethod;
}

/** Trimmed, at most 500 characters, and null when blank. */
function note(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw invalid('body.note', 'Input should be a valid string');
  const trimmed = value.trim();
  if (trimmed.length > 500) {
    throw invalid('body.note', 'String should have at most 500 characters');
  }
  return trimmed || null;
}

function intInRange(
  text: string | null,
  field: string,
  fallback: number,
  min: number,
  max: number,
) {
  if (text === null) return fallback;
  if (!/^-?\d+$/.test(text)) throw invalid(field, 'Input should be a valid integer');
  const value = Number(text);
  if (value < min) throw invalid(field, `Input should be greater than or equal to ${min}`);
  if (value > max) throw invalid(field, `Input should be less than or equal to ${max}`);
  return value;
}

function oneOf<T extends string>(
  text: string | null,
  field: string,
  allowed: readonly T[],
  fallback: T,
) {
  if (text === null) return fallback;
  if (!allowed.includes(text as T)) {
    throw invalid(field, `Input should be ${allowed.map((option) => `'${option}'`).join(' or ')}`);
  }
  return text as T;
}

/** The filters shared by the expense list and the CSV export. */
function expenseFilters(url: URL): DemoExpenseFilters {
  const query = url.searchParams;
  const filters: DemoExpenseFilters = {};
  const dateFrom = query.get('date_from');
  const dateTo = query.get('date_to');
  const categoryId = query.get('category_id');
  const minAmount = query.get('min_amount');
  const maxAmount = query.get('max_amount');
  const method = query.get('payment_method');
  const search = query.get('q');

  if (dateFrom !== null) filters.date_from = isoDate(dateFrom, 'query.date_from');
  if (dateTo !== null) filters.date_to = isoDate(dateTo, 'query.date_to');
  if (categoryId !== null) filters.category_id = resourceId(categoryId, 'query.category_id');
  if (minAmount !== null) {
    filters.min_minor = amountMinor(minAmount, 'query.min_amount', { allowZero: true });
  }
  if (maxAmount !== null) {
    filters.max_minor = amountMinor(maxAmount, 'query.max_amount', { allowZero: true });
  }
  if (method !== null) filters.payment_method = paymentMethod(method, 'query.payment_method');
  if (search !== null) {
    if (search.length > 100) throw invalid('query.q', 'String should have at most 100 characters');
    if (search.trim()) filters.search = search.trim();
  }
  return filters;
}

// ---- responses ------------------------------------------------------------

function errorResponse(error: unknown): Response {
  if (error instanceof DemoError) {
    return HttpResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && { details: error.details }),
        },
      },
      {
        status: error.status,
        headers: error.status === 401 ? { 'WWW-Authenticate': 'Bearer' } : undefined,
      },
    );
  }
  return HttpResponse.json(
    { error: { code: 'internal_error', message: 'Internal server error' } },
    { status: 500 },
  );
}

interface HandlerOptions {
  /** Milliseconds each answer waits, so loading states are visible in the demo. */
  latencyMs?: number;
}

export function createHandlers(
  baseUrl: string,
  db: DemoDb,
  { latencyMs = 0 }: HandlerOptions = {},
): HttpHandler[] {
  type Context = {
    request: Request;
    params: Record<string, string | readonly string[] | undefined>;
  };

  /** Runs a route, turning a `DemoError` into the API's error body. */
  const route =
    (run: (context: Context & { url: URL }) => Promise<Response> | Response) =>
    async ({ request, params }: Context) => {
      if (latencyMs > 0) await delay(latencyMs);
      try {
        return await run({ request, params, url: new URL(request.url) });
      } catch (error) {
        return errorResponse(error);
      }
    };

  /** Like `route`, for the endpoints that need a valid token. */
  const authed = (
    run: (context: Context & { url: URL; userId: number }) => Promise<Response> | Response,
  ) =>
    route((context) =>
      run({ ...context, userId: db.authenticate(context.request.headers.get('Authorization')) }),
    );

  const path = (suffix: string) => `${baseUrl}${suffix}`;
  const noContent = () => new HttpResponse(null, { status: 204 });

  return [
    // ---- auth ----
    http.post(
      path('/auth/register'),
      route(async ({ request }) => {
        const body = await jsonBody(request);
        const { email, password } = body;
        if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          throw invalid('body.email', 'value is not a valid email address');
        }
        if (typeof password !== 'string' || password.length < 8) {
          throw invalid('body.password', 'String should have at least 8 characters');
        }
        if (new TextEncoder().encode(password).length > 72) {
          throw invalid('body.password', 'Value error, Password must be at most 72 bytes long');
        }
        return HttpResponse.json(db.register(email, password), { status: 201 });
      }),
    ),

    http.post(
      path('/auth/login'),
      route(async ({ request }) => {
        // OAuth2 password form: the email arrives in `username`.
        const form = new URLSearchParams(await request.text());
        const username = form.get('username');
        const password = form.get('password');
        if (!username) throw invalid('body.username', 'Field required');
        if (!password) throw invalid('body.password', 'Field required');
        return HttpResponse.json(db.login(username, password));
      }),
    ),

    http.get(
      path('/auth/me'),
      authed(({ userId }) => HttpResponse.json(db.me(userId))),
    ),

    // ---- categories ----
    http.get(
      path('/categories'),
      authed(({ userId }) => HttpResponse.json(db.listCategories(userId))),
    ),

    // ---- expenses ----
    http.get(
      path('/expenses'),
      authed(({ userId, url }) => {
        const query = url.searchParams;
        const page = db.listExpenses(userId, expenseFilters(url), {
          page: intInRange(query.get('page'), 'query.page', 1, 1, 1_000_000),
          page_size: intInRange(query.get('page_size'), 'query.page_size', 20, 1, 100),
          sort: oneOf(query.get('sort'), 'query.sort', EXPENSE_SORTS, 'date'),
          order: oneOf(query.get('order'), 'query.order', ['asc', 'desc'] as const, 'desc'),
        });
        return HttpResponse.json(page);
      }),
    ),

    http.post(
      path('/expenses'),
      authed(async ({ userId, request }) => {
        const body = await jsonBody(request);
        const expense = db.createExpense(userId, {
          amount_minor: amountMinor(body.amount, 'body.amount'),
          category_id: resourceId(body.category_id, 'body.category_id'),
          date: isoDate(body.date, 'body.date'),
          note: note(body.note),
          payment_method: paymentMethod(body.payment_method, 'body.payment_method'),
        });
        return HttpResponse.json(expense, { status: 201 });
      }),
    ),

    // Declared before /expenses/:id, so "export" is not read as an id.
    http.get(
      path('/expenses/export'),
      authed(
        ({ userId, url }) =>
          new HttpResponse(db.exportCsv(userId, expenseFilters(url)), {
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': 'attachment; filename="expenses.csv"',
            },
          }),
      ),
    ),

    http.patch(
      path('/expenses/:id'),
      authed(async ({ userId, request, params }) => {
        const id = resourceId(params.id, 'path.expense_id');
        const body = await jsonBody(request);
        // Only the fields that were sent are changed. Only `note` may be null.
        for (const field of ['amount', 'category_id', 'date', 'payment_method']) {
          if (field in body && body[field] === null) {
            throw invalid('body', `Value error, ${field} cannot be null`);
          }
        }
        const changes = {
          ...('amount' in body && { amount_minor: amountMinor(body.amount, 'body.amount') }),
          ...('category_id' in body && {
            category_id: resourceId(body.category_id, 'body.category_id'),
          }),
          ...('date' in body && { date: isoDate(body.date, 'body.date') }),
          ...('note' in body && { note: note(body.note) }),
          ...('payment_method' in body && {
            payment_method: paymentMethod(body.payment_method, 'body.payment_method'),
          }),
        };
        return HttpResponse.json(db.updateExpense(userId, id, changes));
      }),
    ),

    http.delete(
      path('/expenses/:id'),
      authed(({ userId, params }) => {
        db.deleteExpense(userId, resourceId(params.id, 'path.expense_id'));
        return noContent();
      }),
    ),

    // ---- budgets ----
    http.get(
      path('/budgets'),
      authed(({ userId, url }) => {
        const month = url.searchParams.get('month');
        return HttpResponse.json(
          db.listBudgets(userId, month === null ? undefined : isoMonth(month, 'query.month')),
        );
      }),
    ),

    http.post(
      path('/budgets'),
      authed(async ({ userId, request }) => {
        const body = await jsonBody(request);
        const budget = db.createBudget(userId, {
          category_id: resourceId(body.category_id, 'body.category_id'),
          month: isoMonth(body.month, 'body.month'),
          amount_minor: amountMinor(body.amount, 'body.amount'),
        });
        return HttpResponse.json(budget, { status: 201 });
      }),
    ),

    // Declared before /budgets/:id, so "status" is not read as an id.
    http.get(
      path('/budgets/status'),
      authed(({ userId, url }) =>
        HttpResponse.json(
          db.budgetStatus(userId, isoMonth(url.searchParams.get('month'), 'query.month')),
        ),
      ),
    ),

    http.patch(
      path('/budgets/:id'),
      authed(async ({ userId, request, params }) => {
        const id = resourceId(params.id, 'path.budget_id');
        const body = await jsonBody(request);
        return HttpResponse.json(
          db.updateBudget(userId, id, amountMinor(body.amount, 'body.amount')),
        );
      }),
    ),

    http.delete(
      path('/budgets/:id'),
      authed(({ userId, params }) => {
        db.deleteBudget(userId, resourceId(params.id, 'path.budget_id'));
        return noContent();
      }),
    ),

    // ---- summaries ----
    http.get(
      path('/summary/categories'),
      authed(({ userId, url }) => {
        const from = url.searchParams.get('date_from');
        const to = url.searchParams.get('date_to');
        return HttpResponse.json(
          db.categorySummary(
            userId,
            from === null ? undefined : isoDate(from, 'query.date_from'),
            to === null ? undefined : isoDate(to, 'query.date_to'),
          ),
        );
      }),
    ),

    http.get(
      path('/summary/trends'),
      authed(({ userId, url }) =>
        HttpResponse.json(
          db.trends(userId, intInRange(url.searchParams.get('months'), 'query.months', 6, 1, 36)),
        ),
      ),
    ),
  ];
}
