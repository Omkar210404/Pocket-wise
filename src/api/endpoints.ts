/** One typed function per API endpoint the app uses. Paths and shapes match the backend routers. */

import { request, requestBlob, type QueryValue } from './client';
import type {
  BudgetCreate,
  BudgetOut,
  BudgetStatus,
  BudgetUpdate,
  CategoryOut,
  CategorySummary,
  ExpenseCreate,
  ExpenseFilters,
  ExpenseListParams,
  ExpenseOut,
  ExpensePage,
  ExpenseUpdate,
  IsoDate,
  IsoMonth,
  Token,
  Trends,
  UserCreate,
  UserOut,
} from './types';

const asQuery = (params: object) => params as Record<string, QueryValue>;

export const api = {
  auth: {
    /** Creates the account. The API returns the user and no token: log in next. */
    register: (data: UserCreate) =>
      request<UserOut>('/auth/register', { method: 'POST', json: data, auth: false }),

    /** OAuth2 password form: the email goes in the `username` field. */
    login: (email: string, password: string) =>
      request<Token>('/auth/login', {
        method: 'POST',
        form: { username: email, password },
        auth: false,
      }),

    me: (signal?: AbortSignal) => request<UserOut>('/auth/me', { signal }),
  },

  categories: {
    list: (signal?: AbortSignal) => request<CategoryOut[]>('/categories', { signal }),
  },

  expenses: {
    list: (params: ExpenseListParams, signal?: AbortSignal) =>
      request<ExpensePage>('/expenses', { query: asQuery(params), signal }),

    create: (data: ExpenseCreate) =>
      request<ExpenseOut>('/expenses', { method: 'POST', json: data }),

    update: (id: number, data: ExpenseUpdate) =>
      request<ExpenseOut>(`/expenses/${id}`, { method: 'PATCH', json: data }),

    remove: (id: number) => request<void>(`/expenses/${id}`, { method: 'DELETE' }),

    /** Every expense that matches the filters, oldest first, as a CSV file. */
    exportCsv: (filters: ExpenseFilters) =>
      requestBlob('/expenses/export', { query: asQuery(filters) }),
  },

  budgets: {
    /** Budget, spent, remaining and percent per budgeted category, plus unbudgeted spending. */
    status: (month: IsoMonth, signal?: AbortSignal) =>
      request<BudgetStatus>('/budgets/status', { query: { month }, signal }),

    /** A second budget for the same category and month is a 409: update it instead. */
    create: (data: BudgetCreate) => request<BudgetOut>('/budgets', { method: 'POST', json: data }),

    update: (id: number, data: BudgetUpdate) =>
      request<BudgetOut>(`/budgets/${id}`, { method: 'PATCH', json: data }),

    remove: (id: number) => request<void>(`/budgets/${id}`, { method: 'DELETE' }),
  },

  summary: {
    categories: (range: { date_from?: IsoDate; date_to?: IsoDate }, signal?: AbortSignal) =>
      request<CategorySummary>('/summary/categories', { query: asQuery(range), signal }),

    /** The last `months` calendar months, ending with the server's current month. */
    trends: (months: number, signal?: AbortSignal) =>
      request<Trends>('/summary/trends', { query: { months }, signal }),
  },
};
