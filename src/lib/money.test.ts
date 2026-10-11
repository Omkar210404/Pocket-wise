import { describe, expect, it } from 'vitest';

import { formatMoney, fromMinor, MAX_AMOUNT_MINOR, parseAmountInput, toMinor } from './money';

describe('toMinor / fromMinor', () => {
  it('converts API amount strings to whole minor units', () => {
    expect(toMinor('249.50')).toBe(24950);
    expect(toMinor('0.07')).toBe(7);
    expect(toMinor('12')).toBe(1200);
    expect(toMinor('12.5')).toBe(1250);
    expect(toMinor('-30.25')).toBe(-3025);
    expect(toMinor('9999999.99')).toBe(MAX_AMOUNT_MINOR);
  });

  it('rejects text that is not a two-decimal amount', () => {
    expect(() => toMinor('1.234')).toThrow();
    expect(() => toMinor('abc')).toThrow();
    expect(() => toMinor('')).toThrow();
  });

  it('writes minor units back with exactly two decimals', () => {
    expect(fromMinor(24950)).toBe('249.50');
    expect(fromMinor(7)).toBe('0.07');
    expect(fromMinor(0)).toBe('0.00');
    expect(fromMinor(-3025)).toBe('-30.25');
  });

  it('adds amounts without float drift', () => {
    // 0.1 + 0.2 is 0.30000000000000004 as floats.
    expect(fromMinor(toMinor('0.10') + toMinor('0.20'))).toBe('0.30');
    const total = ['19.99', '5.01', '0.10', '1234.90'].reduce((sum, a) => sum + toMinor(a), 0);
    expect(fromMinor(total)).toBe('1260.00');
  });
});

describe('parseAmountInput', () => {
  it('accepts valid amounts and normalises them to two decimals', () => {
    expect(parseAmountInput('249.5')).toEqual({ ok: true, value: '249.50' });
    expect(parseAmountInput(' 1,200 ')).toEqual({ ok: true, value: '1200.00' });
    expect(parseAmountInput('.5')).toEqual({ ok: true, value: '0.50' });
    expect(parseAmountInput('9999999.99')).toEqual({ ok: true, value: '9999999.99' });
  });

  it.each([
    ['', 'Enter an amount.'],
    ['abc', 'Enter a number, for example 249.50.'],
    ['-5', 'Enter a number, for example 249.50.'],
    ['1.234', 'Use at most two decimal places.'],
    ['0', 'Amount must be greater than zero.'],
    ['0.00', 'Amount must be greater than zero.'],
    ['10000000', 'Amount must be at most 9,999,999.99.'],
  ])('rejects %j with a clear message', (input, message) => {
    expect(parseAmountInput(input)).toEqual({ ok: false, message });
  });
});

describe('formatMoney', () => {
  it('shows two decimals and grouping', () => {
    // The symbol and grouping style depend on the locale, the digits do not.
    expect(formatMoney('249.50')).toContain('249.50');
    expect(formatMoney('0.07')).toContain('0.07');
  });

  it('can drop the decimals for large display numbers', () => {
    expect(formatMoney('1500.00', 'whole')).not.toContain('.00');
  });
});
