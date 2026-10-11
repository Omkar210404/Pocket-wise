/**
 * Calendar dates (`YYYY-MM-DD`) and months (`YYYY-MM`) as the API writes them.
 *
 * They are handled as strings and built from local date parts. `new Date("2026-06-10")`
 * is avoided on purpose: it parses as UTC midnight and shows the previous day
 * in time zones west of UTC.
 */

const pad = (value: number) => String(value).padStart(2, '0');

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function isIsoMonth(value: string): boolean {
  return ISO_MONTH.test(value);
}

/** The day after `iso`. */
export function nextDay(iso: string): string {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  return toIsoDate(new Date(year, month - 1, day + 1));
}

export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

/** The month `count` months after (or before, if negative) `month`. */
export function addMonths(month: string, count: number): string {
  const [year = 0, monthNumber = 1] = month.split('-').map(Number);
  const index = year * 12 + (monthNumber - 1) + count;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** First and last day of a month, for a date range that includes both ends. */
export function monthBounds(month: string): [string, string] {
  const [year = 0, monthNumber = 1] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return [`${month}-01`, `${month}-${pad(lastDay)}`];
}

export function daysInMonth(month: string): number {
  const [year = 0, monthNumber = 1] = month.split('-').map(Number);
  return new Date(year, monthNumber, 0).getDate();
}

/** `"2026-06"` -> `"June 2026"` (long), `"Jun"` (short) or `"June"` (name). */
export function monthLabel(month: string, style: 'long' | 'short' | 'name' = 'long'): string {
  const [year = 0, monthNumber = 1] = month.split('-').map(Number);
  const date = new Date(year, monthNumber - 1, 1);
  if (style === 'short') return date.toLocaleDateString(undefined, { month: 'short' });
  if (style === 'name') return date.toLocaleDateString(undefined, { month: 'long' });
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** `"2026-06-10"` -> `"10 Jun 2026"` in the reader's locale. */
export function formatDate(iso: string): string {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
