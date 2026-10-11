import { Link } from 'react-router-dom';

import type { BudgetStatus, CategorySummary, Trends } from '@/api/types';
import { monthLabel } from '@/lib/dates';
import { formatMinor, toMinor } from '@/lib/money';
import { useCountUp } from '@/lib/motion';
import { Meter } from '@/ui/Meter';
import { Money } from '@/ui/Money';

import styles from './Dashboard.module.css';
import { dailyAverageMinor, daysLeftInMonth, monthComparison } from './shape';

interface MonthTotalProps {
  status: BudgetStatus;
  /** Optional: the count and the comparison fill in when their own requests answer. */
  summary: CategorySummary | undefined;
  trends: Trends | undefined;
  month: string;
  today: string;
}

/** The number the page leads with: everything spent this month. */
export function MonthTotal({ status, summary, trends, month, today }: MonthTotalProps) {
  const totalMinor = toMinor(status.total_spent);
  const shown = useCountUp(totalMinor);
  const comparison = trends ? monthComparison(trends, month) : null;

  return (
    <>
      <p className="label">Spent in {monthLabel(month, 'name')}</p>
      {/* The counting number is decoration: a screen reader gets the final amount once. */}
      <p className={`${styles.heroNumber} money`}>
        <span aria-hidden="true">{formatMinor(shown)}</span>
        <span className="visually-hidden">{formatMinor(totalMinor)}</span>
      </p>
      <p className={styles.heroLine}>
        {summary ? (
          summary.count === 0 ? (
            'No expenses yet this month.'
          ) : (
            <>
              <span className="money">{summary.count}</span>{' '}
              {summary.count === 1 ? 'expense' : 'expenses'},{' '}
              <span className="money">
                {formatMinor(dailyAverageMinor(totalMinor, today), 'whole')}
              </span>{' '}
              a day on average
            </>
          )
        ) : (
          ' '
        )}
      </p>
      {comparison && comparison.direction !== 'same' && (
        <p className={`${styles.delta} ${styles[comparison.direction]}`}>
          <span aria-hidden="true">{comparison.direction === 'up' ? '▲' : '▼'}</span>{' '}
          {comparison.percent === null ? (
            `More than all of ${comparison.against}, which had no spending`
          ) : (
            <>
              <span className="money">{comparison.percent}%</span>{' '}
              {comparison.direction === 'up' ? 'more' : 'less'} than all of {comparison.against}
            </>
          )}
        </p>
      )}
    </>
  );
}

/** How much of the month's total budget is used. */
export function BudgetSummary({
  status,
  month,
  today,
}: {
  status: BudgetStatus;
  month: string;
  today: string;
}) {
  const { totals } = status;
  const daysLeft = daysLeftInMonth(today);

  if (totals.percent_used === null) {
    return (
      <>
        <p className="label">Budget used</p>
        <p className={styles.figure}>No budgets</p>
        <p className={styles.figureLine}>
          Nothing is budgeted for {monthLabel(month, 'name')}.{' '}
          <Link to="/budgets">Set budgets</Link>
        </p>
      </>
    );
  }

  const remaining = toMinor(totals.remaining);
  return (
    <>
      <p className="label">Budget used</p>
      <p className={`${styles.figure} money`}>{totals.percent_used}%</p>
      <Meter percent={totals.percent_used} label="All budgets together" />
      <p className={styles.figureLine}>
        <Money amount={totals.spent} kind="whole" /> of{' '}
        <Money amount={totals.budget} kind="whole" />.{' '}
        {remaining < 0 ? (
          <strong className={styles.overText}>
            Over by <span className="money">{formatMinor(-remaining, 'whole')}</span>.
          </strong>
        ) : (
          <>
            <span className="money">{formatMinor(remaining, 'whole')}</span> left
            {daysLeft > 0 ? ` for ${daysLeft} more ${daysLeft === 1 ? 'day' : 'days'}` : ''}.
          </>
        )}
      </p>
    </>
  );
}

/** The category that took the most this month. */
export function TopCategory({ summary }: { summary: CategorySummary }) {
  const top = summary.categories[0];
  return (
    <>
      <p className="label">Largest category</p>
      {top ? (
        <>
          <p className={styles.figure}>{top.category_name}</p>
          <p className={styles.figureLine}>
            <Money amount={top.total} kind="whole" />, <span className="money">{top.share}%</span>{' '}
            of the month
          </p>
        </>
      ) : (
        <>
          <p className={styles.figure}>None yet</p>
          <p className={styles.figureLine}>It shows up with the month's first expense.</p>
        </>
      )}
    </>
  );
}
