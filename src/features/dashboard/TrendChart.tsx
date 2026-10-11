import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { Trends } from '@/api/types';
import { monthLabel } from '@/lib/dates';
import { formatMinor } from '@/lib/money';
import { prefersReducedMotion } from '@/lib/motion';
import { EmptyState } from '@/ui/States';

import { ChartSection, ChartTooltip } from './ChartSection';
import styles from './Dashboard.module.css';
import { trendRows, type TrendRow } from './shape';

interface ColumnProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: TrendRow;
}

/** A column with a 4px rounded top and a square foot on the baseline. */
function Column({ x = 0, y = 0, width = 0, height = 0, payload }: ColumnProps) {
  if (width <= 0 || height <= 0) return null;
  const r = Math.min(4, width / 2, height);
  const right = x + width;
  const bottom = y + height;
  return (
    <path
      d={`M${x},${bottom} V${y + r} Q${x},${y} ${x + r},${y} H${right - r} Q${right},${y} ${right},${y + r} V${bottom} Z`}
      // Only the month in progress wears the accent. The finished months are context.
      fill={payload?.current ? 'var(--accent)' : 'var(--rule-strong)'}
    />
  );
}

const axisText = { fill: 'var(--ink-3)', fontSize: 12 };

export function TrendChart({ trends, month }: { trends: Trends; month: string }) {
  const rows = trendRows(trends, month);
  const first = rows[0];
  const last = rows.at(-1);
  const hasSpending = rows.some((row) => row.value > 0);
  const data = rows.map((row) => ({
    ...row,
    detail: `${row.count} ${row.count === 1 ? 'expense' : 'expenses'}`,
    // Labelled sparingly: only the month the page is about.
    tip: row.current ? formatMinor(Math.round(row.value * 100), 'compact') : '',
  }));

  return (
    <ChartSection
      label={`Last ${rows.length} months`}
      title="Monthly spending"
      note={`${monthLabel(month, 'name')} is still in progress, so its bar is this month so far.`}
      summary={
        first && last
          ? `Column chart of total spending per month, from ${first.name} (${first.display}) to ${last.name} (${last.display}).`
          : 'Column chart of total spending per month.'
      }
      table={
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col" className={styles.numeric}>
                Expenses
              </th>
              <th scope="col" className={styles.numeric}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.month}>
                <th scope="row">
                  {row.name}
                  {row.current && ' (so far)'}
                </th>
                <td className={`${styles.numeric} money`}>{row.count}</td>
                <td className={`${styles.numeric} money`}>{row.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {hasSpending ? (
        <ResponsiveContainer width="100%" height={248}>
          <BarChart data={data} margin={{ top: 24, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--rule)" />
            <XAxis
              dataKey="label"
              tick={axisText}
              tickLine={false}
              axisLine={{ stroke: 'var(--rule-strong)' }}
            />
            <YAxis
              width={52}
              tick={axisText}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => formatMinor(value * 100, 'compact')}
            />
            <Tooltip
              content={ChartTooltip}
              cursor={{ fill: 'var(--surface-2)' }}
              isAnimationActive={false}
            />
            <Bar
              dataKey="value"
              maxBarSize={24}
              shape={Column}
              isAnimationActive={!prefersReducedMotion()}
              animationDuration={600}
              animationEasing="ease-out"
            >
              <LabelList dataKey="tip" position="top" fill="var(--ink)" fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState title="Nothing to chart yet.">
          Months appear here once they have expenses.
        </EmptyState>
      )}
    </ChartSection>
  );
}
