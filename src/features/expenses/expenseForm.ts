/** The add / edit form's rules, as pure functions. They mirror the API's own checks. */

import {
  PAYMENT_METHODS,
  type ExpenseCreate,
  type ExpenseOut,
  type ExpenseUpdate,
  type PaymentMethod,
} from '@/api/types';
import { isIsoDate, nextDay } from '@/lib/dates';
import { parseAmountInput } from '@/lib/money';

export const MAX_NOTE_LENGTH = 500;
const MIN_DATE = '2000-01-01';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  wallet: 'Wallet',
  other: 'Other',
};

/** The form's fields, as text. */
export interface ExpenseFormValues {
  amount: string;
  date: string;
  category: string;
  method: string;
  note: string;
}

export type ExpenseFormErrors = Partial<Record<keyof ExpenseFormValues, string>>;

export function emptyExpenseForm(today: string): ExpenseFormValues {
  return { amount: '', date: today, category: '', method: 'upi', note: '' };
}

export function formFromExpense(expense: ExpenseOut): ExpenseFormValues {
  return {
    amount: expense.amount,
    date: expense.date,
    category: String(expense.category_id),
    method: expense.payment_method,
    note: expense.note ?? '',
  };
}

export type ExpenseFormResult =
  { ok: true; payload: ExpenseCreate } | { ok: false; errors: ExpenseFormErrors };

/**
 * Checks the form against the API's rules (app/schemas/expense.py and
 * app/services/expenses.py) and builds the request body when it passes.
 * `today` is the reader's local date; the API allows one day ahead of its own
 * UTC date, so tomorrow is accepted here too.
 */
export function validateExpenseForm(values: ExpenseFormValues, today: string): ExpenseFormResult {
  const errors: ExpenseFormErrors = {};

  const amount = parseAmountInput(values.amount);
  if (!amount.ok) errors.amount = amount.message;

  if (!values.date) {
    errors.date = 'Choose a date.';
  } else if (!isIsoDate(values.date)) {
    errors.date = 'Enter a real date.';
  } else if (values.date < MIN_DATE) {
    errors.date = 'Use a date from the year 2000 onwards.';
  } else if (values.date > nextDay(today)) {
    errors.date = 'The date cannot be in the future.';
  }

  if (!/^\d+$/.test(values.category)) errors.category = 'Choose a category.';

  if (!PAYMENT_METHODS.includes(values.method as PaymentMethod)) {
    errors.method = 'Choose how you paid.';
  }

  const note = values.note.trim();
  if (note.length > MAX_NOTE_LENGTH) {
    errors.note = `Keep the note to ${MAX_NOTE_LENGTH} characters or fewer.`;
  }

  if (!amount.ok || Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    payload: {
      amount: amount.value,
      date: values.date,
      category_id: Number(values.category),
      payment_method: values.method as PaymentMethod,
      note: note || null,
    },
  };
}

/** For an edit: only the fields that differ from the saved expense, as PATCH expects. */
export function changedFields(original: ExpenseOut, payload: ExpenseCreate): ExpenseUpdate {
  const changes: ExpenseUpdate = {};
  if (payload.amount !== original.amount) changes.amount = payload.amount;
  if (payload.date !== original.date) changes.date = payload.date;
  if (payload.category_id !== original.category_id) changes.category_id = payload.category_id;
  if (payload.payment_method !== original.payment_method) {
    changes.payment_method = payload.payment_method;
  }
  if ((payload.note ?? null) !== original.note) changes.note = payload.note ?? null;
  return changes;
}

/** Maps the API's field names in a 422 onto this form's field names. */
export function serverFieldErrors(byField: Record<string, string>): ExpenseFormErrors {
  const errors: ExpenseFormErrors = {};
  if (byField.amount) errors.amount = byField.amount;
  if (byField.date) errors.date = byField.date;
  if (byField.category_id) errors.category = byField.category_id;
  if (byField.payment_method) errors.method = byField.payment_method;
  if (byField.note) errors.note = byField.note;
  return errors;
}
