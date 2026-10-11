/**
 * Shapes the API's budget status for the budgets page. The numbers themselves
 * (spent, remaining, percent) come from the API and are not recomputed here.
 */

import type { Amount, BudgetStatus, CategoryOut } from '@/api/types';
import { formatMinor, toMinor } from '@/lib/money';

import { meterState, type MeterTone } from './progress';

/** One line of the budgets page: a category with or without a budget this month. */
export interface BudgetRowData {
  category_id: number;
  name: string;
  /** Null when the category has no budget this month. */
  budget_id: number | null;
  budget: Amount | null;
  spent: Amount;
  remaining: Amount | null;
  percent_used: number | null;
  over_budget: boolean;
}

/**
 * Every category gets a row, in the API's order (by name), whether it has a
 * budget, only spending, or neither. That way a budget can be set on any of them.
 */
export function buildBudgetRows(categories: CategoryOut[], status: BudgetStatus): BudgetRowData[] {
  const budgeted = new Map(status.items.map((item) => [item.category_id, item]));
  const unbudgeted = new Map(status.unbudgeted.map((item) => [item.category_id, item.spent]));

  return categories.map((category) => {
    const item = budgeted.get(category.id);
    if (item) {
      return {
        category_id: category.id,
        name: category.name,
        budget_id: item.budget_id,
        budget: item.budget,
        spent: item.spent,
        remaining: item.remaining,
        percent_used: item.percent_used,
        over_budget: item.over_budget,
      };
    }
    return {
      category_id: category.id,
      name: category.name,
      budget_id: null,
      budget: null,
      spent: unbudgeted.get(category.id) ?? '0.00',
      remaining: null,
      percent_used: null,
      over_budget: false,
    };
  });
}

export interface BudgetStanding {
  text: string;
  tone: MeterTone | 'none';
}

/** The words beside a meter, so the state is never told by colour alone. */
export function budgetStanding(row: {
  remaining: Amount | null;
  percent_used: number | null;
}): BudgetStanding {
  if (row.remaining === null) return { text: 'No budget', tone: 'none' };
  const remaining = toMinor(row.remaining);
  if (remaining < 0) return { text: `Over by ${formatMinor(-remaining)}`, tone: 'over' };
  return { text: `${formatMinor(remaining)} left`, tone: meterState(row.percent_used).tone };
}

/**
 * Budgets do not carry over on the API. These are last month's budgets for
 * the categories that have none yet this month, ready to be created again.
 */
export function budgetsToCopy(
  previous: BudgetStatus,
  current: BudgetStatus,
): { category_id: number; amount: Amount }[] {
  const alreadySet = new Set(current.items.map((item) => item.category_id));
  return previous.items
    .filter((item) => !alreadySet.has(item.category_id))
    .map((item) => ({ category_id: item.category_id, amount: item.budget }));
}
