/**
 * The expense list's filters, as they are kept in the URL.
 *
 * The URL is the single source of truth: `?q=tea&category=3&from=2026-06-01&page=2`.
 * That makes a filtered view survive a reload, work with the back button and
 * be shareable. These functions are pure, so the rules are tested without a browser.
 */

import {
  EXPENSE_SORTS,
  PAYMENT_METHODS,
  type ExpenseFilters,
  type ExpenseListParams,
  type ExpenseSort,
  type PaymentMethod,
  type SortOrder,
} from '@/api/types';
import { isIsoDate } from '@/lib/dates';
import { fromMinor, MAX_AMOUNT_MINOR } from '@/lib/money';

export const PAGE_SIZE = 20;

/** The filter controls' values, as text. An empty string means "not set". */
export interface FilterValues {
  q: string;
  category: string;
  from: string;
  to: string;
  min: string;
  max: string;
  method: string;
}

export interface ListState extends FilterValues {
  page: number;
  sort: ExpenseSort;
  order: SortOrder;
}

export const FILTER_NAMES = ['q', 'category', 'from', 'to', 'min', 'max', 'method'] as const;
export type FilterName = (typeof FILTER_NAMES)[number];

/** Reads the list state from the URL. Anything malformed is treated as not set. */
export function parseListState(params: URLSearchParams): ListState {
  const text = (name: string) => params.get(name)?.trim() ?? '';
  const page = Number(params.get('page'));
  const sort = params.get('sort') as ExpenseSort;
  const method = text('method') as PaymentMethod;

  return {
    q: text('q').slice(0, 100),
    category: /^\d+$/.test(text('category')) ? text('category') : '',
    from: isIsoDate(text('from')) ? text('from') : '',
    to: isIsoDate(text('to')) ? text('to') : '',
    min: text('min'),
    max: text('max'),
    method: PAYMENT_METHODS.includes(method) ? method : '',
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    sort: EXPENSE_SORTS.includes(sort) ? sort : 'date',
    order: params.get('order') === 'asc' ? 'asc' : 'desc',
  };
}

export function countActiveFilters(values: FilterValues): number {
  return FILTER_NAMES.filter((name) => values[name] !== '').length;
}

/** An amount typed into a filter: zero or more, at most two decimals. Null when it is not one. */
function filterAmountMinor(text: string): number | null {
  const cleaned = text.replace(/[\s,]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole = '0', fraction = ''] = cleaned.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0') || '0');
  return minor <= MAX_AMOUNT_MINOR ? minor : null;
}

export interface FilterProblems {
  dates?: string;
  amounts?: string;
}

export interface CheckedFilters {
  /** What to send to the API. Null while a filter has a problem: then nothing is requested. */
  filters: ExpenseFilters | null;
  problems: FilterProblems;
}

/**
 * Turns the controls' text into API filters. The same mistakes the API would
 * answer with a 422 (a reversed range) are caught here first, with a plainer message.
 */
export function checkFilters(values: FilterValues): CheckedFilters {
  const problems: FilterProblems = {};

  if (values.from && values.to && values.from > values.to) {
    problems.dates = 'The start date is after the end date.';
  }

  const min = values.min ? filterAmountMinor(values.min) : undefined;
  const max = values.max ? filterAmountMinor(values.max) : undefined;
  if (min === null || max === null) {
    problems.amounts = 'Enter amounts as numbers, for example 250 or 99.50.';
  } else if (min !== undefined && max !== undefined && min > max) {
    problems.amounts = 'The minimum is more than the maximum.';
  }

  if (problems.dates || problems.amounts) return { filters: null, problems };

  const filters: ExpenseFilters = {};
  if (values.q) filters.q = values.q;
  if (values.category) filters.category_id = Number(values.category);
  if (values.from) filters.date_from = values.from;
  if (values.to) filters.date_to = values.to;
  if (typeof min === 'number') filters.min_amount = fromMinor(min);
  if (typeof max === 'number') filters.max_amount = fromMinor(max);
  if (values.method) filters.payment_method = values.method as PaymentMethod;
  return { filters, problems };
}

export function toListParams(filters: ExpenseFilters, state: ListState): ExpenseListParams {
  return {
    ...filters,
    page: state.page,
    page_size: PAGE_SIZE,
    sort: state.sort,
    order: state.order,
  };
}
