import { describe, expect, it } from 'vitest';

import {
  checkFilters,
  countActiveFilters,
  parseListState,
  toListParams,
  type FilterValues,
} from './filters';

const none: FilterValues = { q: '', category: '', from: '', to: '', min: '', max: '', method: '' };
const parse = (query: string) => parseListState(new URLSearchParams(query));

describe('parseListState', () => {
  it('reads every filter, the sort and the page from the URL', () => {
    expect(
      parse(
        'q=tea&category=3&from=2026-06-01&to=2026-06-30&min=10&max=500&method=upi&page=2&sort=amount&order=asc',
      ),
    ).toEqual({
      q: 'tea',
      category: '3',
      from: '2026-06-01',
      to: '2026-06-30',
      min: '10',
      max: '500',
      method: 'upi',
      page: 2,
      sort: 'amount',
      order: 'asc',
    });
  });

  it('uses the defaults for an empty URL: newest first, page 1, no filters', () => {
    expect(parse('')).toEqual({ ...none, page: 1, sort: 'date', order: 'desc' });
  });

  it('drops values that were tampered with instead of sending them to the API', () => {
    expect(
      parse('category=abc&from=2026-02-30&to=yesterday&method=cheque&page=-4&sort=id&order=up'),
    ).toEqual({ ...none, page: 1, sort: 'date', order: 'desc' });
  });
});

describe('checkFilters', () => {
  it('builds API filters, with amounts normalised to two decimals', () => {
    expect(
      checkFilters({
        q: 'tea',
        category: '3',
        from: '2026-06-01',
        to: '2026-06-30',
        min: '10',
        max: '1,500.5',
        method: 'upi',
      }),
    ).toEqual({
      problems: {},
      filters: {
        q: 'tea',
        category_id: 3,
        date_from: '2026-06-01',
        date_to: '2026-06-30',
        min_amount: '10.00',
        max_amount: '1500.50',
        payment_method: 'upi',
      },
    });
  });

  it('sends nothing for filters that are not set', () => {
    expect(checkFilters(none)).toEqual({ problems: {}, filters: {} });
  });

  it('blocks a start date after the end date', () => {
    expect(checkFilters({ ...none, from: '2026-06-10', to: '2026-06-01' })).toEqual({
      filters: null,
      problems: { dates: 'The start date is after the end date.' },
    });
  });

  it('allows a one-day range', () => {
    expect(checkFilters({ ...none, from: '2026-06-10', to: '2026-06-10' }).filters).toEqual({
      date_from: '2026-06-10',
      date_to: '2026-06-10',
    });
  });

  it('blocks a minimum above the maximum', () => {
    expect(checkFilters({ ...none, min: '500', max: '100' })).toEqual({
      filters: null,
      problems: { amounts: 'The minimum is more than the maximum.' },
    });
  });

  it.each(['abc', '-5', '1.234', '99999999999'])('blocks %j as an amount', (text) => {
    expect(checkFilters({ ...none, min: text })).toEqual({
      filters: null,
      problems: { amounts: 'Enter amounts as numbers, for example 250 or 99.50.' },
    });
  });

  it('accepts zero as a minimum', () => {
    expect(checkFilters({ ...none, min: '0' }).filters).toEqual({ min_amount: '0.00' });
  });
});

describe('helpers', () => {
  it('counts the filters that are set', () => {
    expect(countActiveFilters(none)).toBe(0);
    expect(countActiveFilters({ ...none, q: 'tea', method: 'upi' })).toBe(2);
  });

  it('adds paging and sorting to the filters for the list request', () => {
    expect(toListParams({ q: 'tea' }, { ...none, page: 3, sort: 'amount', order: 'asc' })).toEqual({
      q: 'tea',
      page: 3,
      page_size: 20,
      sort: 'amount',
      order: 'asc',
    });
  });
});
