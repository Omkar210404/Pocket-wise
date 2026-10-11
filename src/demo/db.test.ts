import { describe, expect, it } from 'vitest';

import type { PaymentMethod } from '@/api/types';
import { toMinor } from '@/lib/money';

import { DemoDb, DemoError, percent } from './db';
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemoDb } from './seed';

/** An empty account on 15 June 2026, with a helper to add expenses by category name. */
function setup() {
  let now = new Date(2026, 5, 15, 10);
  const db = new DemoDb(() => now);
  const userId = db.register('first@example.com', 'password-one').id;
  const categories = new Map(db.listCategories(userId).map((c) => [c.name, c.id]));
  const id = (name: string) => categories.get(name) ?? 0;
  const add = (
    category: string,
    amount: string,
    date: string,
    note: string | null = null,
    method: PaymentMethod = 'upi',
  ) =>
    db.insertExpense(userId, {
      category_id: id(category),
      amount_minor: toMinor(amount),
      date,
      note,
      payment_method: method,
    });
  const budget = (category: string, amount: string, month = '2026-06') =>
    db.createBudget(userId, { category_id: id(category), month, amount_minor: toMinor(amount) });
  const paging = { page: 1, page_size: 20, sort: 'date', order: 'desc' } as const;
  return { db, userId, id, add, budget, paging, setNow: (next: Date) => (now = next) };
}

function caught(run: () => unknown): DemoError {
  try {
    run();
  } catch (error) {
    if (error instanceof DemoError) return error;
    throw error;
  }
  throw new Error('Expected a DemoError');
}

describe('percent', () => {
  it('rounds to one decimal, half away from zero, like the backend', () => {
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(2, 3)).toBe(66.7);
    expect(percent(25, 10000)).toBe(0.3);
    expect(percent(-25, 10000)).toBe(-0.3);
    expect(percent(625, 1000)).toBe(62.5);
  });

  it('is null when there is nothing to divide by', () => {
    expect(percent(10, 0)).toBeNull();
  });
});

describe('budget status', () => {
  it('reports budget, spent, remaining and percent for each budgeted category', () => {
    const { db, userId, add, budget } = setup();
    budget('Food', '1000.00');
    budget('Transport', '100.00');
    add('Food', '400.00', '2026-06-02');
    add('Food', '225.00', '2026-06-30');
    add('Transport', '120.50', '2026-06-10');

    const status = db.budgetStatus(userId, '2026-06');

    expect(status.items).toEqual([
      expect.objectContaining({
        category_name: 'Food',
        budget: '1000.00',
        spent: '625.00',
        remaining: '375.00',
        percent_used: 62.5,
        over_budget: false,
      }),
      expect.objectContaining({
        category_name: 'Transport',
        budget: '100.00',
        spent: '120.50',
        remaining: '-20.50',
        percent_used: 120.5,
        over_budget: true,
      }),
    ]);
  });

  it('counts only expenses dated inside the month', () => {
    const { db, userId, add, budget } = setup();
    budget('Food', '1000.00');
    add('Food', '50.00', '2026-05-31');
    add('Food', '70.00', '2026-06-01');
    add('Food', '90.00', '2026-07-01');

    expect(db.budgetStatus(userId, '2026-06').items[0]?.spent).toBe('70.00');
  });

  it('lists spending without a budget separately, largest first, and adds it to the total', () => {
    const { db, userId, add, budget } = setup();
    budget('Food', '1000.00');
    add('Food', '300.00', '2026-06-03');
    add('Health', '50.00', '2026-06-04');
    add('Shopping', '450.00', '2026-06-05');

    const status = db.budgetStatus(userId, '2026-06');

    expect(status.unbudgeted.map((item) => [item.category_name, item.spent])).toEqual([
      ['Shopping', '450.00'],
      ['Health', '50.00'],
    ]);
    expect(status.totals).toEqual({
      budget: '1000.00',
      spent: '300.00',
      remaining: '700.00',
      percent_used: 30,
    });
    expect(status.unbudgeted_spent).toBe('500.00');
    expect(status.total_spent).toBe('800.00');
  });

  it('has a null overall percent when the month has no budgets', () => {
    const { db, userId, add } = setup();
    add('Food', '300.00', '2026-06-03');

    const status = db.budgetStatus(userId, '2026-06');

    expect(status.items).toEqual([]);
    expect(status.totals.percent_used).toBeNull();
    expect(status.total_spent).toBe('300.00');
  });

  it('refuses a second budget for the same category and month', () => {
    const { budget } = setup();
    budget('Food', '1000.00');

    expect(caught(() => budget('Food', '500.00'))).toMatchObject({
      status: 409,
      code: 'conflict',
      message: "A budget for 'Food' in 2026-06 already exists. Change it instead.",
    });
    // The same category in another month is a different budget.
    expect(() => budget('Food', '500.00', '2026-07')).not.toThrow();
  });
});

describe('trends', () => {
  it('compares each month with the one before, reading one month before the window', () => {
    const { db, userId, add } = setup();
    add('Food', '100.00', '2026-03-10');
    add('Food', '200.00', '2026-05-10');
    add('Food', '150.00', '2026-06-10');

    const trends = db.trends(userId, 3);

    expect(trends.months).toEqual([
      // April is empty; March, before the window, had 100.
      { month: '2026-04', total: '0.00', count: 0, change: '-100.00', change_percent: -100 },
      // A change from zero has no percentage.
      { month: '2026-05', total: '200.00', count: 1, change: '200.00', change_percent: null },
      { month: '2026-06', total: '150.00', count: 1, change: '-50.00', change_percent: -25 },
    ]);
    expect(trends.total).toBe('350.00');
    // 350 / 3 = 116.666..., rounded half up to the paisa.
    expect(trends.average_monthly_total).toBe('116.67');
  });
});

describe('category summary', () => {
  it('gives total, count and share per category, largest first, both range ends included', () => {
    const { db, userId, add } = setup();
    add('Food', '100.00', '2026-06-01');
    add('Food', '100.00', '2026-06-30');
    add('Transport', '100.00', '2026-06-15');
    add('Transport', '999.00', '2026-07-01');

    const summary = db.categorySummary(userId, '2026-06-01', '2026-06-30');

    expect(summary.categories).toEqual([
      expect.objectContaining({ category_name: 'Food', total: '200.00', count: 2, share: 66.7 }),
      expect.objectContaining({
        category_name: 'Transport',
        total: '100.00',
        count: 1,
        share: 33.3,
      }),
    ]);
    expect(summary.total).toBe('300.00');
    expect(summary.count).toBe(3);
  });
});

describe('expense list', () => {
  it('combines filters with AND', () => {
    const { db, userId, id, add, paging } = setup();
    add('Food', '120.00', '2026-06-01', 'Lunch');
    add('Food', '900.00', '2026-06-02', 'Groceries');
    add('Transport', '120.00', '2026-06-02', 'Cab');
    add('Food', '130.00', '2026-05-20', 'Lunch');

    const page = db.listExpenses(
      userId,
      { category_id: id('Food'), date_from: '2026-06-01', max_minor: 50000 },
      paging,
    );

    expect(page.items.map((expense) => expense.note)).toEqual(['Lunch']);
    expect(page.total).toBe(1);
  });

  it('searches the note only, ignoring case, and skips expenses without a note', () => {
    const { db, userId, add, paging } = setup();
    add('Food', '10.00', '2026-06-01', 'Coffee, Blue Kettle');
    add('Food', '20.00', '2026-06-02', null);
    add('Food', '30.00', '2026-06-03', 'Tea');

    const page = db.listExpenses(userId, { search: 'KETTLE' }, paging);

    expect(page.items.map((expense) => expense.amount)).toEqual(['10.00']);
  });

  it('sorts by the chosen column with the id as tie-break, and pages the result', () => {
    const { db, userId, add } = setup();
    add('Food', '50.00', '2026-06-01', 'a');
    add('Food', '20.00', '2026-06-02', 'b');
    add('Food', '50.00', '2026-06-03', 'c');

    const first = db.listExpenses(
      userId,
      {},
      { page: 1, page_size: 2, sort: 'amount', order: 'desc' },
    );
    const second = db.listExpenses(
      userId,
      {},
      { page: 2, page_size: 2, sort: 'amount', order: 'desc' },
    );

    expect(first.items.map((expense) => expense.note)).toEqual(['c', 'a']);
    expect(second.items.map((expense) => expense.note)).toEqual(['b']);
    expect(first).toMatchObject({ total: 3, page: 1, page_size: 2, pages: 2 });
  });

  it('rejects a reversed date or amount range, naming the field', () => {
    const { db, userId, paging } = setup();

    expect(
      caught(() =>
        db.listExpenses(userId, { date_from: '2026-06-10', date_to: '2026-06-01' }, paging),
      ),
    ).toMatchObject({
      status: 422,
      details: [{ field: 'query.date_from', message: 'date_from must not be after date_to' }],
    });
    expect(
      caught(() => db.listExpenses(userId, { min_minor: 500, max_minor: 100 }, paging)),
    ).toMatchObject({
      details: [
        { field: 'query.min_amount', message: 'min_amount must not be greater than max_amount' },
      ],
    });
  });
});

describe('expense rules', () => {
  const input = (categoryId: number, date: string) => ({
    category_id: categoryId,
    amount_minor: 1000,
    date,
    note: null,
    payment_method: 'cash' as const,
  });

  it('accepts tomorrow but not the day after', () => {
    const { db, userId, id } = setup();

    expect(() => db.createExpense(userId, input(id('Food'), '2026-06-16'))).not.toThrow();
    expect(caught(() => db.createExpense(userId, input(id('Food'), '2026-06-17')))).toMatchObject({
      status: 422,
      details: [{ field: 'body.date', message: 'Date must not be in the future' }],
    });
  });

  it("does not let one account use or see another account's data", () => {
    const { db, userId, id, add } = setup();
    const other = db.register('second@example.com', 'password-two').id;
    const expense = add('Food', '10.00', '2026-06-01');

    expect(caught(() => db.createExpense(other, input(id('Food'), '2026-06-01')))).toMatchObject({
      details: [{ field: 'body.category_id', message: 'Category not found' }],
    });
    expect(caught(() => db.deleteExpense(other, expense.id))).toMatchObject({
      status: 404,
      message: 'Expense not found',
    });
    expect(
      db.listExpenses(userId, {}, { page: 1, page_size: 20, sort: 'date', order: 'desc' }).total,
    ).toBe(1);
  });
});

describe('CSV export', () => {
  it('writes a header, oldest first, and makes formula-like cells safe', () => {
    const { db, userId, add } = setup();
    add('Food', '20.00', '2026-06-02', '=SUM(A1:A9)');
    add('Food', '10.50', '2026-06-01', 'Tea, with "milk"');

    expect(db.exportCsv(userId, {})).toBe(
      'id,date,amount,category,payment_method,note\r\n' +
        '2,2026-06-01,10.50,Food,upi,"Tea, with ""milk"""\r\n' +
        "1,2026-06-02,20.00,Food,upi,'=SUM(A1:A9)\r\n",
    );
  });
});

describe('demo tokens', () => {
  it('still work after the in-memory database is rebuilt, as on a page reload', () => {
    const now = () => new Date(2026, 5, 15, 10);
    const before = new DemoDb(now);
    seedDemoDb(before, now());
    const token = before.login(DEMO_EMAIL, DEMO_PASSWORD).access_token;

    const after = new DemoDb(now);
    seedDemoDb(after, now());

    expect(after.me(after.authenticate(`Bearer ${token}`)).email).toBe(DEMO_EMAIL);
  });

  it('stop working once their 30 minutes are over', () => {
    const { db, setNow } = setup();
    const token = db.login('first@example.com', 'password-one').access_token;

    setNow(new Date(2026, 5, 15, 10, 29));
    expect(() => db.authenticate(`Bearer ${token}`)).not.toThrow();

    setNow(new Date(2026, 5, 15, 10, 31));
    expect(caught(() => db.authenticate(`Bearer ${token}`))).toMatchObject({
      status: 401,
      message: 'Invalid or expired token',
    });
  });

  it('reject a missing or made-up token', () => {
    const { db } = setup();
    expect(caught(() => db.authenticate(null))).toMatchObject({ message: 'Not authenticated' });
    expect(caught(() => db.authenticate('Bearer nonsense'))).toMatchObject({ status: 401 });
  });
});

describe('seed', () => {
  const seeded = () => {
    const now = new Date(2026, 5, 15, 10);
    const db = new DemoDb(() => now);
    seedDemoDb(db, now);
    const userId = db.authenticate(`Bearer ${db.login(DEMO_EMAIL, DEMO_PASSWORD).access_token}`);
    return { db, userId };
  };

  it('produces the same data every time for the same day', () => {
    const first = seeded();
    const second = seeded();
    expect(first.db.exportCsv(first.userId, {})).toBe(second.db.exportCsv(second.userId, {}));
  });

  it('has six months of history and nothing dated after today', () => {
    const { db, userId } = seeded();
    const trends = db.trends(userId, 6);

    expect(trends.months.map((month) => month.month)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
    ]);
    expect(trends.months.every((month) => month.count > 0)).toBe(true);
    expect(
      db.listExpenses(
        userId,
        { date_from: '2026-06-16' },
        { page: 1, page_size: 1, sort: 'date', order: 'desc' },
      ).total,
    ).toBe(0);
  });

  it('shows every budget state in the current month: fine, over budget, and unbudgeted', () => {
    const { db, userId } = seeded();
    const status = db.budgetStatus(userId, '2026-06');

    expect(status.items.some((item) => item.over_budget)).toBe(true);
    expect(status.items.some((item) => !item.over_budget)).toBe(true);
    expect(status.unbudgeted.length).toBeGreaterThan(0);
  });
});
