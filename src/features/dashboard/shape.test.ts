import { describe, expect, it } from 'vitest';

import type { CategorySummary, Trends } from '@/api/types';

import {
  breakdownRows,
  dailyAverageMinor,
  daysLeftInMonth,
  monthComparison,
  trendRows,
} from './shape';

const trends = (last: { change: string; change_percent: number | null }): Trends => ({
  months: [
    { month: '2026-04', total: '0.00', count: 0, change: '-100.00', change_percent: -100 },
    { month: '2026-05', total: '200.00', count: 2, change: '200.00', change_percent: null },
    { month: '2026-06', total: '150.50', count: 1, ...last },
  ],
  total: '350.50',
  average_monthly_total: '116.83',
});

describe('trendRows', () => {
  const rows = trendRows(trends({ change: '-49.50', change_percent: -24.8 }), '2026-06');

  it('makes one bar per month, oldest first, marking the month in progress', () => {
    expect(rows.map((row) => [row.month, row.value, row.current])).toEqual([
      ['2026-04', 0, false],
      ['2026-05', 200, false],
      ['2026-06', 150.5, true],
    ]);
  });

  it('keeps the count and a formatted total for the tooltip and the table', () => {
    expect(rows[2]).toMatchObject({ count: 1, name: 'June 2026' });
    expect(rows[2]?.display).toContain('150.50');
  });
});

describe('monthComparison', () => {
  it('reports spending below last month as down, with a positive percentage', () => {
    expect(monthComparison(trends({ change: '-49.50', change_percent: -24.8 }), '2026-06')).toEqual(
      { direction: 'down', percent: 24.8, against: 'May' },
    );
  });

  it('reports spending above last month as up', () => {
    expect(monthComparison(trends({ change: '30.00', change_percent: 15 }), '2026-06')).toEqual({
      direction: 'up',
      percent: 15,
      against: 'May',
    });
  });

  it('has no percentage when last month had no spending', () => {
    expect(
      monthComparison(trends({ change: '150.50', change_percent: null }), '2026-06'),
    ).toMatchObject({ direction: 'up', percent: null });
  });

  it("is absent when the API's current month is not the reader's", () => {
    // Around midnight at a month's end the API (UTC) can still be in the old month.
    expect(
      monthComparison(trends({ change: '-49.50', change_percent: -24.8 }), '2026-07'),
    ).toBeNull();
  });
});

describe('breakdownRows', () => {
  const summary = (count: number): CategorySummary => ({
    date_from: '2026-06-01',
    date_to: '2026-06-30',
    // Totals 100, 90, 80, ... so the list is already largest first.
    categories: Array.from({ length: count }, (_, index) => ({
      category_id: index + 1,
      category_name: `Category ${index + 1}`,
      total: `${(10 - index) * 10}.00`,
      count: index + 1,
      share: 10,
    })),
    total: '0.00',
    count: 0,
  });

  it('keeps the API order and every category when there are few', () => {
    const rows = breakdownRows(summary(3));
    expect(rows.map((row) => [row.name, row.value])).toEqual([
      ['Category 1', 100],
      ['Category 2', 90],
      ['Category 3', 80],
    ]);
  });

  it('folds the smallest categories into one "Other" row past the limit', () => {
    const rows = breakdownRows(summary(9), 7);

    expect(rows).toHaveLength(7);
    expect(rows.slice(0, 6).map((row) => row.name)).toEqual([
      'Category 1',
      'Category 2',
      'Category 3',
      'Category 4',
      'Category 5',
      'Category 6',
    ]);
    // Categories 7, 8 and 9: totals 40 + 30 + 20, counts 7 + 8 + 9.
    expect(rows[6]).toMatchObject({
      key: 'other',
      name: 'Other (3 categories)',
      value: 90,
      count: 24,
      share: 40,
    });
  });

  it('does not fold when the count is exactly the limit', () => {
    expect(breakdownRows(summary(7), 7).map((row) => row.key)).not.toContain('other');
  });

  it('is empty for a month without spending', () => {
    expect(breakdownRows(summary(0))).toEqual([]);
  });
});

describe('month arithmetic', () => {
  it('averages over the days of the month that have passed, today included', () => {
    expect(dailyAverageMinor(150_000, '2026-06-15')).toBe(10_000);
    expect(dailyAverageMinor(100, '2026-06-03')).toBe(33);
  });

  it('counts the days after today until the month ends', () => {
    expect(daysLeftInMonth('2026-06-15')).toBe(15);
    expect(daysLeftInMonth('2026-06-30')).toBe(0);
    expect(daysLeftInMonth('2024-02-28')).toBe(1);
  });
});
