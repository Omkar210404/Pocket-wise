import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { useExpenseFilters } from './useExpenseFilters';

/** The hook, plus the query string it has written to the router. */
function setup(initial = '/expenses') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  );
  return renderHook(() => ({ list: useExpenseFilters(), search: useLocation().search }), {
    wrapper,
  });
}

describe('useExpenseFilters', () => {
  it('writes a filter to the URL and reads it back', () => {
    const { result } = setup();

    act(() => result.current.list.setFilter('q', '  tea  '));

    expect(result.current.search).toBe('?q=tea');
    expect(result.current.list.state.q).toBe('tea');
    expect(result.current.list.filters).toEqual({ q: 'tea' });
    expect(result.current.list.activeCount).toBe(1);
  });

  it('goes back to page 1 when a filter changes, keeping the other filters and the sort', () => {
    const { result } = setup('/expenses?category=3&page=4&sort=amount&order=asc');

    act(() => result.current.list.setFilter('method', 'upi'));

    expect(result.current.list.state).toMatchObject({
      category: '3',
      method: 'upi',
      page: 1,
      sort: 'amount',
      order: 'asc',
    });
  });

  it('removes a filter from the URL when it is emptied', () => {
    const { result } = setup('/expenses?q=tea&category=3');

    act(() => result.current.list.setFilter('q', ''));

    expect(result.current.search).toBe('?category=3');
  });

  it('clears every filter at once but keeps the sort', () => {
    const { result } = setup('/expenses?q=tea&from=2026-06-01&min=10&page=2&sort=amount');

    act(() => result.current.list.clearFilters());

    expect(result.current.search).toBe('?sort=amount');
    expect(result.current.list.activeCount).toBe(0);
  });

  it('sets the page, and leaves page 1 out of the URL', () => {
    const { result } = setup('/expenses?q=tea');

    act(() => result.current.list.setPage(3));
    expect(result.current.search).toBe('?q=tea&page=3');

    act(() => result.current.list.setPage(1));
    expect(result.current.search).toBe('?q=tea');
  });

  it('sorts a new column descending first, then flips it on the second press', () => {
    const { result } = setup('/expenses?page=2');

    act(() => result.current.list.toggleSort('amount'));
    expect(result.current.list.state).toMatchObject({ sort: 'amount', order: 'desc', page: 1 });

    act(() => result.current.list.toggleSort('amount'));
    expect(result.current.list.state).toMatchObject({ sort: 'amount', order: 'asc' });
  });

  it('flips the default date sort to oldest first on the first press', () => {
    const { result } = setup();

    act(() => result.current.list.toggleSort('date'));

    expect(result.current.list.state).toMatchObject({ sort: 'date', order: 'asc' });
  });

  it('holds the request back while a range is reversed', () => {
    const { result } = setup('/expenses?from=2026-06-10&to=2026-06-01');

    expect(result.current.list.filters).toBeNull();
    expect(result.current.list.problems.dates).toBe('The start date is after the end date.');
  });
});
