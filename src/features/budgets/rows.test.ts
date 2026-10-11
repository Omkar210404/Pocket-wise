import { describe, expect, it } from 'vitest';

import type { BudgetStatus, CategoryOut } from '@/api/types';

import { budgetStanding, budgetsToCopy, buildBudgetRows } from './rows';

const category = (id: number, name: string): CategoryOut => ({
  id,
  name,
  is_default: true,
  created_at: '2026-01-01T00:00:00Z',
});

const status: BudgetStatus = {
  month: '2026-06',
  items: [
    {
      budget_id: 11,
      category_id: 1,
      category_name: 'Food',
      budget: '1000.00',
      spent: '625.00',
      remaining: '375.00',
      percent_used: 62.5,
      over_budget: false,
    },
    {
      budget_id: 12,
      category_id: 2,
      category_name: 'Transport',
      budget: '100.00',
      spent: '120.50',
      remaining: '-20.50',
      percent_used: 120.5,
      over_budget: true,
    },
  ],
  totals: { budget: '1100.00', spent: '745.50', remaining: '354.50', percent_used: 67.8 },
  unbudgeted: [{ category_id: 3, category_name: 'Health', spent: '50.00' }],
  unbudgeted_spent: '50.00',
  total_spent: '795.50',
};

const empty: BudgetStatus = {
  month: '2026-07',
  items: [],
  totals: { budget: '0.00', spent: '0.00', remaining: '0.00', percent_used: null },
  unbudgeted: [],
  unbudgeted_spent: '0.00',
  total_spent: '0.00',
};

describe('buildBudgetRows', () => {
  const rows = buildBudgetRows(
    [category(1, 'Food'), category(3, 'Health'), category(4, 'Other'), category(2, 'Transport')],
    status,
  );

  it('gives every category a row, in the order the API lists them', () => {
    expect(rows.map((row) => row.name)).toEqual(['Food', 'Health', 'Other', 'Transport']);
  });

  it("uses the API's numbers for a budgeted category", () => {
    expect(rows[0]).toEqual({
      category_id: 1,
      name: 'Food',
      budget_id: 11,
      budget: '1000.00',
      spent: '625.00',
      remaining: '375.00',
      percent_used: 62.5,
      over_budget: false,
    });
  });

  it('shows spending for a category that has no budget', () => {
    expect(rows[1]).toMatchObject({
      name: 'Health',
      budget_id: null,
      budget: null,
      spent: '50.00',
      remaining: null,
      percent_used: null,
    });
  });

  it('shows zero for a category with neither budget nor spending', () => {
    expect(rows[2]).toMatchObject({ name: 'Other', budget: null, spent: '0.00' });
  });
});

describe('budgetStanding', () => {
  it('says how much is left while under budget', () => {
    const standing = budgetStanding({ remaining: '375.00', percent_used: 62.5 });
    expect(standing.text).toMatch(/375\.00 left$/);
    expect(standing.tone).toBe('ok');
  });

  it('warns when the budget is nearly used up', () => {
    expect(budgetStanding({ remaining: '50.00', percent_used: 95 }).tone).toBe('near');
  });

  it('says by how much a budget is exceeded, as a positive amount', () => {
    const standing = budgetStanding({ remaining: '-20.50', percent_used: 120.5 });
    expect(standing.text).toMatch(/^Over by .*20\.50$/);
    expect(standing.text).not.toContain('-');
    expect(standing.tone).toBe('over');
  });

  it('counts a budget spent to the last paisa as used, not as over', () => {
    const standing = budgetStanding({ remaining: '0.00', percent_used: 100 });
    expect(standing.text).toMatch(/0\.00 left$/);
    expect(standing.tone).toBe('near');
  });

  it('says so when there is no budget', () => {
    expect(budgetStanding({ remaining: null, percent_used: null })).toEqual({
      text: 'No budget',
      tone: 'none',
    });
  });
});

describe('budgetsToCopy', () => {
  it("offers last month's budgets for a month that has none", () => {
    expect(budgetsToCopy(status, empty)).toEqual([
      { category_id: 1, amount: '1000.00' },
      { category_id: 2, amount: '100.00' },
    ]);
  });

  it('leaves out categories that already have a budget this month', () => {
    const partly: BudgetStatus = { ...empty, items: [{ ...status.items[0]!, budget_id: 99 }] };
    expect(budgetsToCopy(status, partly)).toEqual([{ category_id: 2, amount: '100.00' }]);
  });

  it('offers nothing when last month had no budgets either', () => {
    expect(budgetsToCopy(empty, empty)).toEqual([]);
  });
});
