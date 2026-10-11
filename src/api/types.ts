/**
 * Types for the Expense-Tracker-API, written by hand from its Pydantic schemas.
 * Each block names the backend file it mirrors. Field names are the API's own
 * (snake_case), so a response can be used without mapping.
 *
 * Money is always a string with two decimal places ("249.50"). Use
 * `lib/money.ts` to do arithmetic on it.
 */

/** A decimal amount as a string, for example "249.50". */
export type Amount = string;
/** A calendar date, "YYYY-MM-DD". */
export type IsoDate = string;
/** A calendar month, "YYYY-MM". */
export type IsoMonth = string;
/** A timestamp in ISO 8601. */
export type IsoDateTime = string;

// ---- app/schemas/auth.py ---------------------------------------------------

export interface UserCreate {
  email: string;
  /** At least 8 characters, at most 72 bytes. */
  password: string;
}

export interface UserOut {
  id: number;
  email: string;
  created_at: IsoDateTime;
}

export interface Token {
  access_token: string;
  token_type: string;
  /** Seconds until the token expires. */
  expires_in: number;
}

// ---- app/schemas/category.py -----------------------------------------------

export interface CategoryOut {
  id: number;
  name: string;
  /** True for the categories created at registration. */
  is_default: boolean;
  created_at: IsoDateTime;
}

// ---- app/models.py: PaymentMethod ------------------------------------------

export const PAYMENT_METHODS = ['cash', 'card', 'upi', 'bank_transfer', 'wallet', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// ---- app/schemas/expense.py ------------------------------------------------

export interface ExpenseCreate {
  amount: Amount;
  category_id: number;
  date: IsoDate;
  note?: string | null;
  payment_method: PaymentMethod;
}

/** Send only the fields to change. Only `note` may be null (it clears the note). */
export interface ExpenseUpdate {
  amount?: Amount;
  category_id?: number;
  date?: IsoDate;
  note?: string | null;
  payment_method?: PaymentMethod;
}

export interface ExpenseOut {
  id: number;
  amount: Amount;
  category_id: number;
  category_name: string;
  date: IsoDate;
  note: string | null;
  payment_method: PaymentMethod;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ExpensePage {
  items: ExpenseOut[];
  /** Number of expenses that match the filters. */
  total: number;
  page: number;
  page_size: number;
  /** Number of pages at this page size. */
  pages: number;
}

// ---- app/routers/expenses.py: query parameters -----------------------------

/** Shared by the list and the CSV export. All optional, combined with AND. */
export interface ExpenseFilters {
  date_from?: IsoDate;
  date_to?: IsoDate;
  category_id?: number;
  min_amount?: Amount;
  max_amount?: Amount;
  payment_method?: PaymentMethod;
  /** Text to find in the note, ignoring case. */
  q?: string;
}

export const EXPENSE_SORTS = ['date', 'amount', 'created_at'] as const;
export type ExpenseSort = (typeof EXPENSE_SORTS)[number];
export type SortOrder = 'asc' | 'desc';

export interface ExpenseListParams extends ExpenseFilters {
  /** 1 or more. Default 1. */
  page?: number;
  /** 1 to 100. Default 20. */
  page_size?: number;
  sort?: ExpenseSort;
  order?: SortOrder;
}

// ---- app/schemas/budget.py -------------------------------------------------

export interface BudgetCreate {
  category_id: number;
  month: IsoMonth;
  amount: Amount;
}

export interface BudgetUpdate {
  amount: Amount;
}

export interface BudgetOut {
  id: number;
  category_id: number;
  category_name: string;
  month: IsoMonth;
  amount: Amount;
}

export interface BudgetStatusItem {
  budget_id: number;
  category_id: number;
  category_name: string;
  budget: Amount;
  spent: Amount;
  /** Budget minus spent. Negative when over budget. */
  remaining: Amount;
  /** Spent as a percentage of the budget, one decimal. */
  percent_used: number;
  over_budget: boolean;
}

export interface UnbudgetedItem {
  category_id: number;
  category_name: string;
  spent: Amount;
}

export interface BudgetTotals {
  budget: Amount;
  /** Spending in the budgeted categories only. */
  spent: Amount;
  remaining: Amount;
  /** Null when the month has no budgets. */
  percent_used: number | null;
}

export interface BudgetStatus {
  month: IsoMonth;
  items: BudgetStatusItem[];
  totals: BudgetTotals;
  unbudgeted: UnbudgetedItem[];
  unbudgeted_spent: Amount;
  /** All spending in the month, budgeted or not. */
  total_spent: Amount;
}

// ---- app/schemas/summary.py ------------------------------------------------

export interface CategoryTotalOut {
  category_id: number;
  category_name: string;
  total: Amount;
  count: number;
  /** Percentage of the overall total, one decimal. */
  share: number;
}

export interface CategorySummary {
  date_from: IsoDate | null;
  date_to: IsoDate | null;
  /** Largest total first. Only categories with expenses. */
  categories: CategoryTotalOut[];
  total: Amount;
  count: number;
}

export interface TrendMonth {
  month: IsoMonth;
  total: Amount;
  count: number;
  /** This month's total minus the previous month's. */
  change: Amount;
  /** Null when the previous month's total is zero. */
  change_percent: number | null;
}

export interface Trends {
  /** Oldest first, ending with the server's current month (UTC). */
  months: TrendMonth[];
  total: Amount;
  average_monthly_total: Amount;
}

// ---- app/schemas/common.py: the body of every error response ----------------

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[] | null;
  };
}
