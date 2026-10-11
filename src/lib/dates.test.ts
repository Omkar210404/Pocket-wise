import { describe, expect, it } from 'vitest';

import {
  addMonths,
  currentMonth,
  daysInMonth,
  isIsoDate,
  monthBounds,
  nextDay,
  todayIso,
} from './dates';

describe('dates', () => {
  it('writes today and the current month from local date parts', () => {
    const now = new Date(2026, 5, 9, 23, 30); // 9 June 2026, late evening
    expect(todayIso(now)).toBe('2026-06-09');
    expect(currentMonth(now)).toBe('2026-06');
  });

  it('adds months across year ends', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2025-12', 1)).toBe('2026-01');
    expect(addMonths('2026-06', -5)).toBe('2026-01');
    expect(addMonths('2026-06', 0)).toBe('2026-06');
  });

  it('gives the first and last day of a month, leap years included', () => {
    expect(monthBounds('2026-06')).toEqual(['2026-06-01', '2026-06-30']);
    expect(monthBounds('2024-02')).toEqual(['2024-02-01', '2024-02-29']);
    expect(monthBounds('2026-02')).toEqual(['2026-02-01', '2026-02-28']);
    expect(daysInMonth('2026-12')).toBe(31);
  });

  it('recognises real calendar dates only', () => {
    expect(isIsoDate('2026-06-10')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('10/06/2026')).toBe(false);
    expect(isIsoDate('')).toBe(false);
  });

  it('steps to the next day across month ends', () => {
    expect(nextDay('2026-06-30')).toBe('2026-07-01');
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
  });
});
