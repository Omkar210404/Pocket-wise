import { useEffect, useState } from 'react';

import type { ExpenseOut } from '@/api/types';
import { PageHeader } from '@/layout/PageHeader';
import { Button } from '@/ui/Button';
import { Pagination } from '@/ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/ui/States';

import { useCategories } from '../categories';
import { DeleteExpenseDialog } from './DeleteExpenseDialog';
import { ExpenseFiltersBar } from './ExpenseFiltersBar';
import { ExpensePanel, type PanelTarget } from './ExpensePanel';
import { ExpenseTable } from './ExpenseTable';
import { ExportButton } from './ExportButton';
import { PAGE_SIZE, toListParams } from './filters';
import { useExpenses } from './queries';
import { useExpenseFilters } from './useExpenseFilters';

export default function ExpensesPage() {
  const list = useExpenseFilters();
  const { state, filters, setPage } = list;
  const expenses = useExpenses(filters ? toListParams(filters, state) : null);
  const categories = useCategories();
  const [panel, setPanel] = useState<PanelTarget | null>(null);
  const [deleting, setDeleting] = useState<ExpenseOut | null>(null);

  const page = expenses.data;
  const total = page?.total ?? 0;

  // Deleting the last row of the last page leaves the URL one page too far.
  useEffect(() => {
    if (page && page.pages > 0 && state.page > page.pages) setPage(page.pages);
  }, [page, state.page, setPage]);

  const filtering = list.activeCount > 0;
  const summary = !page
    ? null
    : filtering
      ? `${total} ${total === 1 ? 'expense matches' : 'expenses match'} the filters.`
      : `${total} ${total === 1 ? 'expense' : 'expenses'} in all.`;

  return (
    <>
      <PageHeader
        label="The ledger"
        title="Expenses"
        lead={summary}
        actions={
          <>
            <ExportButton filters={filters} total={total} />
            <Button variant="primary" onClick={() => setPanel({ kind: 'new' })}>
              Add expense
            </Button>
          </>
        }
      />

      <ExpenseFiltersBar
        values={state}
        problems={list.problems}
        activeCount={list.activeCount}
        categories={categories.data ?? []}
        onChange={list.setFilter}
        onClear={list.clearFilters}
      />

      {!filters ? (
        <EmptyState title="Fix the filters to see expenses.">
          {list.problems.dates ?? list.problems.amounts}
        </EmptyState>
      ) : expenses.isPending ? (
        <LoadingState rows={8} label="Loading expenses" />
      ) : expenses.isError ? (
        <ErrorState
          title="Could not load expenses"
          error={expenses.error}
          onRetry={() => void expenses.refetch()}
        />
      ) : expenses.data.items.length === 0 ? (
        filtering ? (
          <EmptyState
            title="Nothing matches these filters."
            action={
              <Button small onClick={list.clearFilters}>
                Clear filters
              </Button>
            }
          >
            Try a wider date range or fewer filters.
          </EmptyState>
        ) : (
          <EmptyState
            title="No expenses yet."
            action={
              <Button variant="primary" onClick={() => setPanel({ kind: 'new' })}>
                Add your first expense
              </Button>
            }
          >
            Once you add one, it shows up here and in the overview.
          </EmptyState>
        )
      ) : (
        <>
          <ExpenseTable
            items={expenses.data.items}
            sort={state.sort}
            order={state.order}
            onSort={list.toggleSort}
            onEdit={(expense) => setPanel({ kind: 'edit', expense })}
            onDelete={setDeleting}
            stale={expenses.isPlaceholderData}
          />
          <Pagination
            page={expenses.data.page}
            pages={expenses.data.pages}
            total={expenses.data.total}
            pageSize={PAGE_SIZE}
            onPage={setPage}
          />
        </>
      )}

      <ExpensePanel target={panel} onClose={() => setPanel(null)} />
      <DeleteExpenseDialog expense={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
