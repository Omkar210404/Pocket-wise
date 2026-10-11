/**
 * DEMO DATA LAYER. Nothing in this folder talks to a real server.
 *
 * `DemoDb` is an in-memory stand-in for the Expense-Tracker-API. It follows
 * the backend's rules (expense-tracker-api/app/services) closely enough for
 * the app to behave the same way: the same filters, the same budget and
 * summary definitions, the same error format. It is a re-implementation, not
 * the backend, and it resets when the page reloads.
 */

import type {
  BudgetOut,
  BudgetStatus,
  CategoryOut,
  CategorySummary,
  ExpenseOut,
  ExpensePage,
  ExpenseSort,
  PaymentMethod,
  SortOrder,
  Token,
  Trends,
  UserOut,
} from '@/api/types';
import { addMonths, currentMonth, monthBounds, nextDay, toIsoDate } from '@/lib/dates';
import { fromMinor } from '@/lib/money';

/** An error the fake API reports, in the backend's own format. */
export class DemoError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: { field: string; message: string }[] | undefined;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: { field: string; message: string }[],
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const invalid = (field: string, message: string) =>
  new DemoError(422, 'validation_error', 'Request validation failed', [{ field, message }]);

const notFound = (what: string) => new DemoError(404, 'not_found', `${what} not found`);
const unauthorized = (message: string) => new DemoError(401, 'unauthorized', message);

/** Same list as the backend gives every new account (services/categories.py). */
export const DEFAULT_CATEGORIES = [
  'Food',
  'Transport',
  'Housing',
  'Utilities',
  'Health',
  'Entertainment',
  'Shopping',
  'Education',
  'Other',
] as const;

const TOKEN_LIFETIME_SECONDS = 30 * 60;
const MIN_DATE = '2000-01-01';

interface UserRow {
  id: number;
  email: string;
  password: string;
  created_at: string;
}

interface CategoryRow {
  id: number;
  user_id: number;
  name: string;
  is_default: boolean;
  created_at: string;
}

interface ExpenseRow {
  id: number;
  user_id: number;
  category_id: number;
  amount_minor: number;
  date: string;
  note: string | null;
  payment_method: PaymentMethod;
  created_at: string;
  updated_at: string;
}

interface BudgetRow {
  id: number;
  user_id: number;
  category_id: number;
  month: string;
  amount_minor: number;
}

export interface DemoExpenseFilters {
  date_from?: string;
  date_to?: string;
  category_id?: number;
  min_minor?: number;
  max_minor?: number;
  payment_method?: PaymentMethod;
  search?: string;
}

export interface DemoExpenseInput {
  amount_minor: number;
  category_id: number;
  date: string;
  note: string | null;
  payment_method: PaymentMethod;
}

/** `part` as a percentage of `whole`, one decimal, rounded half away from zero. Null when `whole` is 0. */
export function percent(part: number, whole: number): number | null {
  if (whole === 0) return null;
  const sign = Math.sign(part) * Math.sign(whole) < 0 ? -1 : 1;
  const numerator = Math.abs(part) * 1000;
  const denominator = Math.abs(whole);
  let tenths = Math.floor(numerator / denominator);
  if (2 * (numerator - tenths * denominator) >= denominator) tenths += 1;
  return (sign * tenths) / 10;
}

/** `total / count`, rounded half up to a whole minor unit. */
function divideMinor(total: number, count: number): number {
  return Math.floor((2 * total + count) / (2 * count));
}

const fold = (text: string) => text.toLocaleLowerCase();

/** A cell that a spreadsheet would run as a formula gets a leading apostrophe (services/export.py). */
function neutralise(text: string | null): string {
  if (!text) return '';
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export class DemoDb {
  private users: UserRow[] = [];
  private categories: CategoryRow[] = [];
  private expenses: ExpenseRow[] = [];
  private budgets: BudgetRow[] = [];
  private lastId = { user: 0, category: 0, expense: 0, budget: 0 };
  private readonly now: () => Date;

  /** `now` is injectable so tests can fix "today". */
  constructor(now: () => Date = () => new Date()) {
    this.now = now;
  }

  private today(): string {
    return toIsoDate(this.now());
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  // ---- auth ---------------------------------------------------------------

  register(email: string, password: string): UserOut {
    const normalised = email.trim().toLowerCase();
    if (this.users.some((user) => user.email === normalised)) {
      throw new DemoError(409, 'conflict', 'An account with this email already exists');
    }
    const user: UserRow = {
      id: ++this.lastId.user,
      email: normalised,
      password,
      created_at: this.timestamp(),
    };
    this.users.push(user);
    for (const name of DEFAULT_CATEGORIES) this.insertCategory(user.id, name, true);
    return { id: user.id, email: user.email, created_at: user.created_at };
  }

  login(email: string, password: string): Token {
    const normalised = email.trim().toLowerCase();
    const user = this.users.find((candidate) => candidate.email === normalised);
    if (!user || user.password !== password) {
      throw unauthorized('Incorrect email or password');
    }
    const expires = Math.floor(this.now().getTime() / 1000) + TOKEN_LIFETIME_SECONDS;
    // Shaped like the backend's JWT (subject and expiry in the payload) but
    // unsigned: there is nothing to protect in the demo. Because the token
    // carries its own expiry, it still works after a page reload re-creates
    // this in-memory database.
    const payload = btoa(JSON.stringify({ sub: String(user.id), exp: expires }));
    return {
      access_token: `demo.${payload}.unsigned`,
      token_type: 'bearer',
      expires_in: TOKEN_LIFETIME_SECONDS,
    };
  }

  /** The user id behind a bearer token, or a 401 in the backend's words. */
  authenticate(authorization: string | null): number {
    const token = authorization?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) throw unauthorized('Not authenticated');
    try {
      const payload: unknown = JSON.parse(atob(token.split('.')[1] ?? ''));
      const { sub, exp } = payload as { sub?: unknown; exp?: unknown };
      const userId = Number(sub);
      const known = this.users.some((user) => user.id === userId);
      if (known && typeof exp === 'number' && exp * 1000 > this.now().getTime()) return userId;
    } catch {
      // Not one of this demo's tokens.
    }
    throw unauthorized('Invalid or expired token');
  }

  me(userId: number): UserOut {
    const user = this.users.find((candidate) => candidate.id === userId);
    if (!user) throw unauthorized('Invalid or expired token');
    return { id: user.id, email: user.email, created_at: user.created_at };
  }

  // ---- categories ---------------------------------------------------------

  insertCategory(userId: number, name: string, isDefault = false): CategoryRow {
    const category: CategoryRow = {
      id: ++this.lastId.category,
      user_id: userId,
      name,
      is_default: isDefault,
      created_at: this.timestamp(),
    };
    this.categories.push(category);
    return category;
  }

  listCategories(userId: number): CategoryOut[] {
    return this.categories
      .filter((category) => category.user_id === userId)
      .sort((a, b) => fold(a.name).localeCompare(fold(b.name)) || a.id - b.id)
      .map(({ id, name, is_default, created_at }) => ({ id, name, is_default, created_at }));
  }

  private category(userId: number, categoryId: number): CategoryRow | undefined {
    return this.categories.find((c) => c.user_id === userId && c.id === categoryId);
  }

  /** The category named in a request body. It must be one of the caller's own. */
  private ownCategory(userId: number, categoryId: number): CategoryRow {
    const category = this.category(userId, categoryId);
    if (!category) throw invalid('body.category_id', 'Category not found');
    return category;
  }

  private categoryName(categoryId: number): string {
    return this.categories.find((category) => category.id === categoryId)?.name ?? '';
  }

  // ---- expenses -----------------------------------------------------------

  private checkDate(date: string): void {
    if (date < MIN_DATE) throw invalid('body.date', `Date must not be before ${MIN_DATE}`);
    // One day ahead is accepted, as on the backend.
    if (date > nextDay(this.today())) throw invalid('body.date', 'Date must not be in the future');
  }

  private toExpenseOut(expense: ExpenseRow): ExpenseOut {
    return {
      id: expense.id,
      amount: fromMinor(expense.amount_minor),
      category_id: expense.category_id,
      category_name: this.categoryName(expense.category_id),
      date: expense.date,
      note: expense.note,
      payment_method: expense.payment_method,
      created_at: expense.created_at,
      updated_at: expense.updated_at,
    };
  }

  /** Adds a row without the request checks. Used by the seed and by `createExpense`. */
  insertExpense(userId: number, input: DemoExpenseInput, createdAt?: string): ExpenseRow {
    const stamp = createdAt ?? this.timestamp();
    const expense: ExpenseRow = {
      id: ++this.lastId.expense,
      user_id: userId,
      ...input,
      created_at: stamp,
      updated_at: stamp,
    };
    this.expenses.push(expense);
    return expense;
  }

  createExpense(userId: number, input: DemoExpenseInput): ExpenseOut {
    this.checkDate(input.date);
    this.ownCategory(userId, input.category_id);
    return this.toExpenseOut(this.insertExpense(userId, input));
  }

  private expense(userId: number, expenseId: number): ExpenseRow {
    const expense = this.expenses.find((e) => e.user_id === userId && e.id === expenseId);
    if (!expense) throw notFound('Expense');
    return expense;
  }

  updateExpense(userId: number, expenseId: number, changes: Partial<DemoExpenseInput>): ExpenseOut {
    const expense = this.expense(userId, expenseId);
    if (changes.date !== undefined) this.checkDate(changes.date);
    if (changes.category_id !== undefined) this.ownCategory(userId, changes.category_id);
    Object.assign(expense, changes, { updated_at: this.timestamp() });
    return this.toExpenseOut(expense);
  }

  deleteExpense(userId: number, expenseId: number): void {
    const expense = this.expense(userId, expenseId);
    this.expenses = this.expenses.filter((candidate) => candidate !== expense);
  }

  private matching(userId: number, filters: DemoExpenseFilters): ExpenseRow[] {
    const { date_from, date_to, min_minor, max_minor } = filters;
    if (date_from && date_to && date_from > date_to) {
      throw invalid('query.date_from', 'date_from must not be after date_to');
    }
    if (min_minor !== undefined && max_minor !== undefined && min_minor > max_minor) {
      throw invalid('query.min_amount', 'min_amount must not be greater than max_amount');
    }
    const search = filters.search ? fold(filters.search) : null;
    return this.expenses.filter(
      (expense) =>
        expense.user_id === userId &&
        (!date_from || expense.date >= date_from) &&
        (!date_to || expense.date <= date_to) &&
        (filters.category_id === undefined || expense.category_id === filters.category_id) &&
        (min_minor === undefined || expense.amount_minor >= min_minor) &&
        (max_minor === undefined || expense.amount_minor <= max_minor) &&
        (!filters.payment_method || expense.payment_method === filters.payment_method) &&
        (!search || (expense.note !== null && fold(expense.note).includes(search))),
    );
  }

  listExpenses(
    userId: number,
    filters: DemoExpenseFilters,
    paging: { page: number; page_size: number; sort: ExpenseSort; order: SortOrder },
  ): ExpensePage {
    const { page, page_size, sort, order } = paging;
    const key = (expense: ExpenseRow): string | number =>
      sort === 'amount'
        ? expense.amount_minor
        : sort === 'created_at'
          ? expense.created_at
          : expense.date;
    const direction = order === 'desc' ? -1 : 1;
    const rows = this.matching(userId, filters).sort((a, b) => {
      const [left, right] = [key(a), key(b)];
      const byKey = left < right ? -1 : left > right ? 1 : 0;
      // The id breaks ties, so the order is stable from one page to the next.
      return direction * (byKey || a.id - b.id);
    });
    const start = (page - 1) * page_size;
    return {
      items: rows.slice(start, start + page_size).map((expense) => this.toExpenseOut(expense)),
      total: rows.length,
      page,
      page_size,
      pages: Math.ceil(rows.length / page_size),
    };
  }

  /** Every match, oldest first, as CSV text with a header row (services/export.py). */
  exportCsv(userId: number, filters: DemoExpenseFilters): string {
    const rows = this.matching(userId, filters).sort(
      (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
    );
    const lines = [['id', 'date', 'amount', 'category', 'payment_method', 'note']];
    for (const expense of rows) {
      lines.push([
        String(expense.id),
        expense.date,
        fromMinor(expense.amount_minor),
        neutralise(this.categoryName(expense.category_id)),
        expense.payment_method,
        neutralise(expense.note),
      ]);
    }
    return lines.map((line) => line.map(csvCell).join(',') + '\r\n').join('');
  }

  // ---- totals shared by budgets and summaries -----------------------------

  private totalsByCategory(userId: number, dateFrom?: string, dateTo?: string) {
    const totals = new Map<number, { total: number; count: number }>();
    for (const expense of this.matching(userId, { date_from: dateFrom, date_to: dateTo })) {
      const entry = totals.get(expense.category_id) ?? { total: 0, count: 0 };
      entry.total += expense.amount_minor;
      entry.count += 1;
      totals.set(expense.category_id, entry);
    }
    return [...totals].map(([category_id, { total, count }]) => ({
      category_id,
      category_name: this.categoryName(category_id),
      total,
      count,
    }));
  }

  private totalsByMonth(userId: number, firstMonth: string, lastMonth: string) {
    const totals = new Map<string, { total: number; count: number }>();
    const from = monthBounds(firstMonth)[0];
    const to = monthBounds(lastMonth)[1];
    for (const expense of this.matching(userId, { date_from: from, date_to: to })) {
      const month = expense.date.slice(0, 7);
      const entry = totals.get(month) ?? { total: 0, count: 0 };
      entry.total += expense.amount_minor;
      entry.count += 1;
      totals.set(month, entry);
    }
    return totals;
  }

  // ---- budgets ------------------------------------------------------------

  private toBudgetOut(budget: BudgetRow): BudgetOut {
    return {
      id: budget.id,
      category_id: budget.category_id,
      category_name: this.categoryName(budget.category_id),
      month: budget.month,
      amount: fromMinor(budget.amount_minor),
    };
  }

  private budgetsFor(userId: number, month?: string): BudgetRow[] {
    return this.budgets
      .filter((budget) => budget.user_id === userId && (!month || budget.month === month))
      .sort(
        (a, b) =>
          b.month.localeCompare(a.month) ||
          fold(this.categoryName(a.category_id)).localeCompare(
            fold(this.categoryName(b.category_id)),
          ) ||
          a.id - b.id,
      );
  }

  createBudget(
    userId: number,
    input: { category_id: number; month: string; amount_minor: number },
  ): BudgetOut {
    const category = this.ownCategory(userId, input.category_id);
    const duplicate = this.budgets.some(
      (budget) =>
        budget.user_id === userId &&
        budget.category_id === category.id &&
        budget.month === input.month,
    );
    if (duplicate) {
      throw new DemoError(
        409,
        'conflict',
        `A budget for '${category.name}' in ${input.month} already exists. Change it instead.`,
      );
    }
    const budget: BudgetRow = { id: ++this.lastId.budget, user_id: userId, ...input };
    this.budgets.push(budget);
    return this.toBudgetOut(budget);
  }

  listBudgets(userId: number, month?: string): BudgetOut[] {
    return this.budgetsFor(userId, month).map((budget) => this.toBudgetOut(budget));
  }

  private budget(userId: number, budgetId: number): BudgetRow {
    const budget = this.budgets.find((b) => b.user_id === userId && b.id === budgetId);
    if (!budget) throw notFound('Budget');
    return budget;
  }

  updateBudget(userId: number, budgetId: number, amountMinor: number): BudgetOut {
    const budget = this.budget(userId, budgetId);
    budget.amount_minor = amountMinor;
    return this.toBudgetOut(budget);
  }

  deleteBudget(userId: number, budgetId: number): void {
    const budget = this.budget(userId, budgetId);
    this.budgets = this.budgets.filter((candidate) => candidate !== budget);
  }

  /**
   * Spent vs budget for one month (services/budgets.py). Only expenses dated
   * inside the month count. Spending in a category without a budget that month
   * is listed under `unbudgeted`, so nothing is hidden.
   */
  budgetStatus(userId: number, month: string): BudgetStatus {
    const monthBudgets = this.budgetsFor(userId, month);
    const [from, to] = monthBounds(month);
    const spending = this.totalsByCategory(userId, from, to);
    const spentBy = new Map(spending.map((row) => [row.category_id, row.total]));
    const budgetedIds = new Set(monthBudgets.map((budget) => budget.category_id));

    const items = monthBudgets.map((budget) => {
      const spent = spentBy.get(budget.category_id) ?? 0;
      return {
        budget_id: budget.id,
        category_id: budget.category_id,
        category_name: this.categoryName(budget.category_id),
        budget: fromMinor(budget.amount_minor),
        spent: fromMinor(spent),
        remaining: fromMinor(budget.amount_minor - spent),
        // A budget is always above zero, so this is never null.
        percent_used: percent(spent, budget.amount_minor) ?? 0,
        over_budget: spent > budget.amount_minor,
      };
    });

    const unbudgetedRows = spending
      .filter((row) => !budgetedIds.has(row.category_id))
      .sort(
        (a, b) => b.total - a.total || fold(a.category_name).localeCompare(fold(b.category_name)),
      );

    const totalBudget = monthBudgets.reduce((sum, budget) => sum + budget.amount_minor, 0);
    const budgetedSpent = [...budgetedIds].reduce((sum, id) => sum + (spentBy.get(id) ?? 0), 0);
    const unbudgetedSpent = unbudgetedRows.reduce((sum, row) => sum + row.total, 0);

    return {
      month,
      items,
      totals: {
        budget: fromMinor(totalBudget),
        spent: fromMinor(budgetedSpent),
        remaining: fromMinor(totalBudget - budgetedSpent),
        percent_used: percent(budgetedSpent, totalBudget),
      },
      unbudgeted: unbudgetedRows.map((row) => ({
        category_id: row.category_id,
        category_name: row.category_name,
        spent: fromMinor(row.total),
      })),
      unbudgeted_spent: fromMinor(unbudgetedSpent),
      total_spent: fromMinor(budgetedSpent + unbudgetedSpent),
    };
  }

  // ---- summaries ----------------------------------------------------------

  /** Total, count and share per category, largest first (services/summaries.py). */
  categorySummary(userId: number, dateFrom?: string, dateTo?: string): CategorySummary {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw invalid('query.date_from', 'date_from must not be after date_to');
    }
    const rows = this.totalsByCategory(userId, dateFrom, dateTo).sort(
      (a, b) => b.total - a.total || fold(a.category_name).localeCompare(fold(b.category_name)),
    );
    const overall = rows.reduce((sum, row) => sum + row.total, 0);
    return {
      date_from: dateFrom ?? null,
      date_to: dateTo ?? null,
      categories: rows.map((row) => ({
        category_id: row.category_id,
        category_name: row.category_name,
        total: fromMinor(row.total),
        count: row.count,
        share: percent(row.total, overall) ?? 0,
      })),
      total: fromMinor(overall),
      count: rows.reduce((sum, row) => sum + row.count, 0),
    };
  }

  /**
   * The last `months` calendar months ending with the current one. Each month
   * is compared with the month before it; the month before the window is read
   * too, so the first month in the window also has a change.
   */
  trends(userId: number, months: number): Trends {
    const current = currentMonth(this.now());
    const first = addMonths(current, -(months - 1));
    const beforeFirst = addMonths(first, -1);
    const totals = this.totalsByMonth(userId, beforeFirst, current);

    const items = [];
    let previous = totals.get(beforeFirst)?.total ?? 0;
    let windowTotal = 0;
    for (let offset = 0; offset < months; offset += 1) {
      const month = addMonths(first, offset);
      const { total, count } = totals.get(month) ?? { total: 0, count: 0 };
      const change = total - previous;
      items.push({
        month,
        total: fromMinor(total),
        count,
        change: fromMinor(change),
        change_percent: percent(change, previous),
      });
      windowTotal += total;
      previous = total;
    }

    return {
      months: items,
      total: fromMinor(windowTotal),
      average_monthly_total: fromMinor(divideMinor(windowTotal, months)),
    };
  }
}
