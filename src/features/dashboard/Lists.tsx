import { Link } from 'react-router-dom';

import type { BudgetStatus, ExpensePage } from '@/api/types';
import { budgetStanding } from '@/features/budgets/rows';
import { formatDayMonth, monthLabel } from '@/lib/dates';
import { Meter } from '@/ui/Meter';
import { Money } from '@/ui/Money';
import { Section } from '@/ui/Section';
import { EmptyState } from '@/ui/States';

import styles from './Dashboard.module.css';

/** Spent against budget for each budgeted category, then the spending that has no budget. */
export function BudgetProgressList({ status, month }: { status: BudgetStatus; month: string }) {
  const empty = status.items.length === 0 && status.unbudgeted.length === 0;

  return (
    <Section
      label={monthLabel(month)}
      title="Spent against budget"
      actions={
        <Link to="/budgets" className={styles.more}>
          Edit budgets
        </Link>
      }
    >
      {empty ? (
        <EmptyState title={`No budgets or spending in ${monthLabel(month, 'name')} yet.`}>
          Set a budget for a category to track it here.
        </EmptyState>
      ) : (
        <>
          {status.items.length === 0 ? (
            <p className={styles.note}>
              No category has a budget this month. <Link to="/budgets">Set budgets</Link> to see
              progress here.
            </p>
          ) : (
            <ul className={styles.progress}>
              {status.items.map((item) => {
                const standing = budgetStanding(item);
                return (
                  <li key={item.budget_id}>
                    <div className={styles.progressHead}>
                      <span className={styles.progressName}>{item.category_name}</span>
                      <span className={`${styles.standing} ${styles[standing.tone] ?? ''} money`}>
                        {standing.text}
                      </span>
                    </div>
                    <Meter percent={item.percent_used} label={`${item.category_name} budget`} />
                    <p className={styles.progressFoot}>
                      <span>
                        <Money amount={item.spent} /> of <Money amount={item.budget} />
                      </span>
                      <span className="money">{item.percent_used}%</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          )}

          {status.unbudgeted.length > 0 && (
            <div className={styles.unbudgeted}>
              <p className="label">Without a budget</p>
              <ul className={styles.rows}>
                {status.unbudgeted.map((item) => (
                  <li key={item.category_id}>
                    <span>{item.category_name}</span>
                    <Money amount={item.spent} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Section>
  );
}

/** The latest entries in the ledger. */
export function RecentExpenses({ page }: { page: ExpensePage }) {
  return (
    <Section
      label="Latest entries"
      title="Recent expenses"
      actions={
        <Link to="/expenses" className={styles.more}>
          All expenses
        </Link>
      }
    >
      {page.items.length === 0 ? (
        <EmptyState title="No expenses yet.">
          Use "Add expense" at the top of this page to record the first one.
        </EmptyState>
      ) : (
        <ul className={styles.rows}>
          {page.items.map((expense) => (
            <li key={expense.id}>
              <span className={`${styles.rowDate} money`}>{formatDayMonth(expense.date)}</span>
              <span className={styles.rowText}>
                {expense.note ?? expense.category_name}
                <span className={styles.rowMeta}>{expense.category_name}</span>
              </span>
              <Money amount={expense.amount} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
