import { describe, expect, it } from 'vitest';

import type { ExpenseOut } from '@/api/types';

import {
  changedFields,
  emptyExpenseForm,
  formFromExpense,
  serverFieldErrors,
  validateExpenseForm,
  type ExpenseFormValues,
} from './expenseForm';

const TODAY = '2026-06-15';
const valid: ExpenseFormValues = {
  amount: '249.5',
  date: '2026-06-10',
  category: '3',
  method: 'upi',
  note: '  Lunch with the team  ',
};

const errorsFor = (values: Partial<ExpenseFormValues>) => {
  const result = validateExpenseForm({ ...valid, ...values }, TODAY);
  return result.ok ? {} : result.errors;
};

describe('validateExpenseForm', () => {
  it('builds the request body from a valid form', () => {
    expect(validateExpenseForm(valid, TODAY)).toEqual({
      ok: true,
      payload: {
        amount: '249.50',
        date: '2026-06-10',
        category_id: 3,
        payment_method: 'upi',
        note: 'Lunch with the team',
      },
    });
  });

  it('sends null for an empty note', () => {
    const result = validateExpenseForm({ ...valid, note: '   ' }, TODAY);
    expect(result.ok && result.payload.note).toBeNull();
  });

  it('starts a new expense on today, paid by UPI, with nothing else filled in', () => {
    expect(emptyExpenseForm(TODAY)).toEqual({
      amount: '',
      date: TODAY,
      category: '',
      method: 'upi',
      note: '',
    });
  });

  it.each([
    ['', 'Enter an amount.'],
    ['0', 'Amount must be greater than zero.'],
    ['12.345', 'Use at most two decimal places.'],
    ['ten', 'Enter a number, for example 249.50.'],
    ['10000000', 'Amount must be at most 9,999,999.99.'],
  ])('rejects the amount %j', (amount, message) => {
    expect(errorsFor({ amount })).toEqual({ amount: message });
  });

  it('accepts tomorrow, as the API does, but nothing later', () => {
    expect(errorsFor({ date: '2026-06-16' })).toEqual({});
    expect(errorsFor({ date: '2026-06-17' })).toEqual({
      date: 'The date cannot be in the future.',
    });
  });

  it('rejects a missing, impossible or too early date', () => {
    expect(errorsFor({ date: '' })).toEqual({ date: 'Choose a date.' });
    expect(errorsFor({ date: '2026-02-30' })).toEqual({ date: 'Enter a real date.' });
    expect(errorsFor({ date: '1999-12-31' })).toEqual({
      date: 'Use a date from the year 2000 onwards.',
    });
  });

  it('requires a category', () => {
    expect(errorsFor({ category: '' })).toEqual({ category: 'Choose a category.' });
  });

  it('limits the note to 500 characters after trimming', () => {
    expect(errorsFor({ note: 'x'.repeat(500) })).toEqual({});
    expect(errorsFor({ note: 'x'.repeat(501) })).toEqual({
      note: 'Keep the note to 500 characters or fewer.',
    });
  });

  it('reports every problem at once', () => {
    expect(Object.keys(errorsFor({ amount: '', date: '', category: '' }))).toEqual([
      'amount',
      'date',
      'category',
    ]);
  });
});

describe('editing', () => {
  const saved: ExpenseOut = {
    id: 7,
    amount: '249.50',
    category_id: 3,
    category_name: 'Food',
    date: '2026-06-10',
    note: 'Lunch',
    payment_method: 'upi',
    created_at: '2026-06-10T12:00:00Z',
    updated_at: '2026-06-10T12:00:00Z',
  };
  const same = {
    amount: '249.50',
    date: '2026-06-10',
    category_id: 3,
    payment_method: 'upi',
    note: 'Lunch',
  } as const;

  it('fills the form from a saved expense', () => {
    expect(formFromExpense(saved)).toEqual({
      amount: '249.50',
      date: '2026-06-10',
      category: '3',
      method: 'upi',
      note: 'Lunch',
    });
  });

  it('sends nothing when nothing changed', () => {
    expect(changedFields(saved, same)).toEqual({});
  });

  it('sends only the fields that changed', () => {
    expect(changedFields(saved, { ...same, amount: '300.00', payment_method: 'card' })).toEqual({
      amount: '300.00',
      payment_method: 'card',
    });
  });

  it('sends note: null to clear a note', () => {
    expect(changedFields(saved, { ...same, note: null })).toEqual({ note: null });
  });
});

describe('serverFieldErrors', () => {
  it("maps the API's field names onto the form's", () => {
    expect(
      serverFieldErrors({ category_id: 'Category not found', payment_method: 'Bad value' }),
    ).toEqual({ category: 'Category not found', method: 'Bad value' });
  });
});
