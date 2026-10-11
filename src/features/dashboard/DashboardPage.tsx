import { useState } from 'react';

import { useBudgetStatus } from '@/features/budgets/queries';
import { ExpensePanel, type PanelTarget } from '@/features/expenses/ExpensePanel';
import { PageHeader } from '@/layout/PageHeader';
import { currentMonth, monthLabel, todayIso } from '@/lib/dates';
import { Button } from '@/ui/Button';
import { QueryState } from '@/ui/QueryState';

import { CategoryBreakdown } from './CategoryBreakdown';
import styles from './Dashboard.module.css';
import { BudgetSummary, MonthTotal, TopCategory } from './Figures';
import { BudgetProgressList, RecentExpenses } from './Lists';
import { useCategorySummary, useRecentExpenses, useTrends } from './queries';
import { TrendChart } from './TrendChart';

export default function DashboardPage() {
  const month = currentMonth();
  const today = todayIso();
  const status = useBudgetStatus(month);
  const summary = useCategorySummary(month);
  const trends = useTrends();
  const recent = useRecentExpenses();
  const [panel, setPanel] = useState<PanelTarget | null>(null);

  return (
    <>
      <PageHeader
        label="Overview"
        title={monthLabel(month)}
        actions={
          <Button variant="primary" onClick={() => setPanel({ kind: 'new' })}>
            Add expense
          </Button>
        }
      />

      {/* A bento grid: cells of different sizes, divided by hairline rules instead of card boxes. */}
      <div className={styles.grid}>
        <div className={`${styles.cell} ${styles.hero}`}>
          <QueryState query={status} errorTitle="Could not load this month's total" rows={3}>
            {(data) => (
              <MonthTotal
                status={data}
                summary={summary.data}
                trends={trends.data}
                month={month}
                today={today}
              />
            )}
          </QueryState>
        </div>

        <div className={`${styles.cell} ${styles.budget}`}>
          <QueryState query={status} errorTitle="Could not load the budgets" rows={3}>
            {(data) => <BudgetSummary status={data} month={month} today={today} />}
          </QueryState>
        </div>

        <div className={`${styles.cell} ${styles.top}`}>
          <QueryState query={summary} errorTitle="Could not load the categories" rows={3}>
            {(data) => <TopCategory summary={data} />}
          </QueryState>
        </div>

        <div className={`${styles.cell} ${styles.trend}`}>
          <QueryState query={trends} errorTitle="Could not load the monthly trend" rows={6}>
            {(data) => <TrendChart trends={data} month={month} />}
          </QueryState>
        </div>

        <div className={`${styles.cell} ${styles.breakdown}`}>
          <QueryState query={summary} errorTitle="Could not load the category breakdown" rows={6}>
            {(data) => <CategoryBreakdown summary={data} month={month} />}
          </QueryState>
        </div>

        <div className={`${styles.cell} ${styles.progressCell}`}>
          <QueryState query={status} errorTitle="Could not load budget progress" rows={6}>
            {(data) => <BudgetProgressList status={data} month={month} />}
          </QueryState>
        </div>

        <div className={`${styles.cell} ${styles.recent}`}>
          <QueryState query={recent} errorTitle="Could not load recent expenses" rows={5}>
            {(data) => <RecentExpenses page={data} />}
          </QueryState>
        </div>
      </div>

      <ExpensePanel target={panel} onClose={() => setPanel(null)} />
    </>
  );
}
