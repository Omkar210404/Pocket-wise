/**
 * Shapes API responses for the dashboard's charts and figures. Pure functions:
 * the charts draw whatever these return, so these are what the tests check.
 */

import type { CategorySummary, Trends } from '@/api/types';
import { daysInMonth, monthLabel } from '@/lib/dates';
import { formatMinor, toMinor } from '@/lib/money';

export interface TrendRow {
  month: string;
  /** Short month name for the axis: "Jun". */
  label: string;
  /** Long name for the tooltip and the table: "June 2026". */
  name: string;
  /** The total in currency units, for the bar's height only. Never used for arithmetic. */
  value: number;
  /** The total, formatted. */
  display: string;
  count: number;
  /** True for the month that is still in progress. */
  current: boolean;
}

export function trendRows(trends: Trends, thisMonth: string): TrendRow[] {
  return trends.months.map((month) => {
    const minor = toMinor(month.total);
    return {
      month: month.month,
      label: monthLabel(month.month, 'short'),
      name: monthLabel(month.month),
      value: minor / 100,
      display: formatMinor(minor),
      count: month.count,
      current: month.month === thisMonth,
    };
  });
}

export interface MonthComparison {
  direction: 'up' | 'down' | 'same';
  /** The size of the change, without its sign. Null when last month was zero. */
  percent: number | null;
  /** The month compared against: "May". */
  against: string;
}

/**
 * How this month's spending so far compares with all of last month. Null when
 * the API's current month is not the reader's (the API uses UTC, so for a few
 * hours around a month's end they can differ).
 */
export function monthComparison(trends: Trends, thisMonth: string): MonthComparison | null {
  const current = trends.months.at(-1);
  const previous = trends.months.at(-2);
  if (!current || !previous || current.month !== thisMonth) return null;
  const change = toMinor(current.change);
  return {
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'same',
    percent: current.change_percent === null ? null : Math.abs(current.change_percent),
    against: monthLabel(previous.month, 'name'),
  };
}

export interface BreakdownRow {
  /** Stable key: the category id, or "other" for the folded tail. */
  key: string;
  name: string;
  value: number;
  display: string;
  /** Percentage of the month's total, one decimal. */
  share: number;
  count: number;
}

/**
 * The category bars, largest first as the API sends them. Past `limit` rows
 * the smallest categories are folded into one "Other" row, so the chart stays
 * readable however many categories there are.
 */
export function breakdownRows(summary: CategorySummary, limit = 7): BreakdownRow[] {
  const rows: BreakdownRow[] = summary.categories.map((category) => {
    const minor = toMinor(category.total);
    return {
      key: String(category.category_id),
      name: category.category_name,
      value: minor / 100,
      display: formatMinor(minor),
      share: category.share,
      count: category.count,
    };
  });
  if (rows.length <= limit) return rows;

  const kept = rows.slice(0, limit - 1);
  const tail = summary.categories.slice(limit - 1);
  const tailMinor = tail.reduce((sum, category) => sum + toMinor(category.total), 0);
  const keptShare = kept.reduce((sum, row) => sum + row.share, 0);
  return [
    ...kept,
    {
      key: 'other',
      name: `Other (${tail.length} categories)`,
      value: tailMinor / 100,
      display: formatMinor(tailMinor),
      // What is left of 100%, so the shares still add up after rounding.
      share: Math.max(0, Math.round((100 - keptShare) * 10) / 10),
      count: tail.reduce((sum, category) => sum + category.count, 0),
    },
  ];
}

/** Average spent per day so far this month, in minor units. `today` is "YYYY-MM-DD". */
export function dailyAverageMinor(totalMinor: number, today: string): number {
  const dayOfMonth = Number(today.slice(8, 10));
  return dayOfMonth > 0 ? Math.round(totalMinor / dayOfMonth) : 0;
}

/** Days after today until the month ends. */
export function daysLeftInMonth(today: string): number {
  return daysInMonth(today.slice(0, 7)) - Number(today.slice(8, 10));
}
