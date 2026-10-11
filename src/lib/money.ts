/**
 * Money helpers.
 *
 * The API sends and accepts amounts as decimal strings with two places
 * ("249.50"). They stay strings in the app. Any arithmetic or comparison goes
 * through whole minor units (24950), the same way the backend stores them, so
 * no sum ever picks up a float rounding error.
 */

import { currency } from '@/env';

const AMOUNT_PATTERN = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

/** The API's upper limit, 9,999,999.99, in minor units. */
export const MAX_AMOUNT_MINOR = 999_999_999;

/** `"249.50"` -> `24950`. Throws on anything that is not a two-decimal amount. */
export function toMinor(amount: string): number {
  const match = AMOUNT_PATTERN.exec(amount.trim());
  if (!match) throw new Error(`Not a valid amount: "${amount}"`);
  const [, sign, whole = '0', fraction = ''] = match;
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return sign === '-' ? -minor : minor;
}

/** `24950` -> `"249.50"`, always with two decimal places. */
export function fromMinor(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const absolute = Math.abs(Math.round(minor));
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, '0');
  return `${sign}${whole}.${fraction}`;
}

export type AmountResult = { ok: true; value: string } | { ok: false; message: string };

/**
 * Check what a person typed into an amount field against the API's rules:
 * greater than zero, at most 9,999,999.99, at most two decimal places.
 * Thousands separators and surrounding spaces are accepted and removed.
 */
export function parseAmountInput(text: string): AmountResult {
  const cleaned = text.replace(/[\s,]/g, '');
  if (cleaned === '') return { ok: false, message: 'Enter an amount.' };
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === '.') {
    return { ok: false, message: 'Enter a number, for example 249.50.' };
  }
  const [whole = '', fraction = ''] = cleaned.split('.');
  if (fraction.length > 2) {
    return { ok: false, message: 'Use at most two decimal places.' };
  }
  const minor = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0') || '0');
  if (minor <= 0) return { ok: false, message: 'Amount must be greater than zero.' };
  if (minor > MAX_AMOUNT_MINOR) {
    return { ok: false, message: 'Amount must be at most 9,999,999.99.' };
  }
  return { ok: true, value: fromMinor(minor) };
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(kind: 'full' | 'compact' | 'whole'): Intl.NumberFormat {
  const key = `${currency}:${kind}`;
  let cached = formatters.get(key);
  if (!cached) {
    cached = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      ...(kind === 'compact' && { notation: 'compact', maximumFractionDigits: 1 }),
      ...(kind === 'whole' && { maximumFractionDigits: 0 }),
    });
    formatters.set(key, cached);
  }
  return cached;
}

/** The currency's symbol in the reader's locale, for example `₹`. Used in field labels. */
export function currencySymbol(): string {
  const part = formatter('whole')
    .formatToParts(0)
    .find((piece) => piece.type === 'currency');
  return part?.value ?? currency;
}

/** Format minor units for display, for example `24950` -> `₹249.50`. */
export function formatMinor(minor: number, kind: 'full' | 'compact' | 'whole' = 'full'): string {
  return formatter(kind).format(minor / 100);
}

/** Format an API amount string for display. */
export function formatMoney(amount: string, kind: 'full' | 'compact' | 'whole' = 'full'): string {
  return formatMinor(toMinor(amount), kind);
}
