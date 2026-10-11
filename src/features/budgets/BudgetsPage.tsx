import { useSearchParams } from 'react-router-dom';

import { errorMessage } from '@/api/errors';
import type { BudgetStatus } from '@/api/types';
import { PageHeader } from '@/layout/PageHeader';
import { addMonths, currentMonth, isIsoMonth, monthLabel } from '@/lib/dates';
import { toMinor } from '@/lib/money';
import { Button } from '@/ui/Button';
import { Money } from '@/ui/Money';
import { EmptyState, ErrorNote, ErrorState, LoadingState } from '@/ui/States';
import { useToast } from '@/ui/toastContext';

import { useCategories } from '../categories';
import { BudgetRow } from './BudgetRow';
import styles from './BudgetsPage.module.css';
import { MonthPicker } from './MonthPicker';
import { useBudgetStatus, useCopyBudgets } from './queries';
import { budgetsToCopy, buildBudgetRows } from './rows';

function Totals({ status }: { status: BudgetStatus }) {
  const remaining = toMinor(status.totals.remaining);
  return (
    <dl className={styles.totals}>
      <div>
        <dt className="label">Budgeted</dt>
        <dd>
          <Money amount={status.totals.budget} />
        </dd>
      </div>
      <div>
        <dt className="label">Spent against budgets</dt>
        <dd>
          <Money amount={status.totals.spent} />
        </dd>
      </div>
      <div>
        <dt className="label">{remaining < 0 ? 'Over budget by' : 'Left to spend'}</dt>
        <dd className={remaining < 0 ? styles.over : undefined}>
          <Money amount={status.totals.remaining.replace('-', '')} />
        </dd>
      </div>
      <div>
        <dt className="label">Spent without a budget</dt>
        <dd>
          <Money amount={status.unbudgeted_spent} />
        </dd>
      </div>
    </dl>
  );
}

/** Offered when a month has no budgets yet but the month before it did. */
function CopyLastMonth({ month, status }: { month: string; status: BudgetStatus }) {
  const previousMonth = addMonths(month, -1);
  const empty = status.items.length === 0;
  const previous = useBudgetStatus(previousMonth, { enabled: empty });
  const copy = useCopyBudgets(month);
  const { notify } = useToast();

  if (!empty || !previous.data) return null;
  const budgets = budgetsToCopy(previous.data, status);
  if (budgets.length === 0) return null;

  async function copyBudgets() {
    try {
      const count = await copy.mutateAsync(budgets);
      notify(`Copied ${count} ${count === 1 ? 'budget' : 'budgets'} to ${monthLabel(month)}`);
    } catch {
      // The message is shown from `copy.error` below.
    }
  }

  return (
    <div className={styles.copy}>
      <p>
        {monthLabel(month)} has no budgets yet. Budgets do not carry over from one month to the
        next.
      </p>
      <Button busy={copy.isPending} onClick={() => void copyBudgets()}>
        Copy {budgets.length} {budgets.length === 1 ? 'budget' : 'budgets'} from{' '}
        {monthLabel(previousMonth)}
      </Button>
      {copy.isError && <ErrorNote>{errorMessage(copy.error)}</ErrorNote>}
    </div>
  );
}

export default function BudgetsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('month') ?? '';
  const month = isIsoMonth(requested) ? requested : currentMonth();

  const categories = useCategories();
  const status = useBudgetStatus(month);

  function changeMonth(next: string) {
    setSearchParams(next === currentMonth() ? {} : { month: next });
  }

  return (
    <>
      <PageHeader
        label="Monthly limits"
        title="Budgets"
        lead="Set what you plan to spend in each category. A budget covers one month."
        actions={<MonthPicker month={month} onChange={changeMonth} />}
      />

      {categories.isPending || status.isPending ? (
        <LoadingState rows={8} label="Loading budgets" />
      ) : categories.isError || status.isError ? (
        <ErrorState
          title="Could not load budgets"
          error={categories.error ?? status.error}
          onRetry={() => {
            void categories.refetch();
            void status.refetch();
          }}
        />
      ) : categories.data.length === 0 ? (
        <EmptyState title="You have no categories.">
          Budgets are set per category, so there is nothing to budget for yet.
        </EmptyState>
      ) : (
        <>
          <Totals status={status.data} />
          <CopyLastMonth month={month} status={status.data} />
          <table className={styles.table}>
            <caption className="visually-hidden">Budgets for {monthLabel(month)}</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col" className={styles.spent}>
                  Spent
                </th>
                <th scope="col">Budget</th>
                <th scope="col">Progress</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {buildBudgetRows(categories.data, status.data).map((row) => (
                // The month is part of the key, so a row's typed text never leaks into another month.
                <BudgetRow key={`${month}-${row.category_id}`} row={row} month={month} />
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
