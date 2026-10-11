import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { CategorySummary } from '@/api/types';
import { monthLabel } from '@/lib/dates';
import { formatMinor } from '@/lib/money';
import { prefersReducedMotion } from '@/lib/motion';
import { EmptyState } from '@/ui/States';

import { ChartSection, ChartTooltip } from './ChartSection';
import styles from './Dashboard.module.css';
import { breakdownRows } from './shape';

const ROW_HEIGHT = 38;
const NAME_LIMIT = 15;

interface BarProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/** A bar with a 4px rounded data end and a square start on the baseline. */
function HorizontalBar({ x = 0, y = 0, width = 0, height = 0 }: BarProps) {
  if (width <= 0 || height <= 0) return null;
  const r = Math.min(4, height / 2, width);
  const right = x + width;
  const bottom = y + height;
  return (
    <path
      d={`M${x},${y} H${right - r} Q${right},${y} ${right},${y + r} V${bottom - r} Q${right},${bottom} ${right - r},${bottom} H${x} Z`}
      fill="var(--accent)"
    />
  );
}

const shorten = (name: string) =>
  name.length > NAME_LIMIT ? `${name.slice(0, NAME_LIMIT - 1)}…` : name;

export function CategoryBreakdown({ summary, month }: { summary: CategorySummary; month: string }) {
  const rows = breakdownRows(summary);
  const top = rows[0];
  const data = rows.map((row) => ({
    ...row,
    detail: `${row.share}% of spending, ${row.count} ${row.count === 1 ? 'expense' : 'expenses'}`,
    // Whole units at the bar's tip. The exact amount is in the tooltip and the table.
    tip: formatMinor(Math.round(row.value * 100), 'whole'),
  }));

  return (
    <ChartSection
      label={monthLabel(month)}
      title="Where it went"
      summary={
        top
          ? `Bar chart of spending per category, largest first. ${top.name} is the largest at ${top.display}, ${top.share}% of the month.`
          : 'Bar chart of spending per category.'
      }
      table={
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col" className={styles.numeric}>
                Share
              </th>
              <th scope="col" className={styles.numeric}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.name}</th>
                <td className={`${styles.numeric} money`}>{row.share}%</td>
                <td className={`${styles.numeric} money`}>{row.display}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {rows.length > 0 ? (
        <ResponsiveContainer width="100%" height={rows.length * ROW_HEIGHT + 8}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 68, bottom: 4, left: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={112}
              tick={{ fill: 'var(--ink-2)', fontSize: 13 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={shorten}
            />
            <Tooltip
              content={ChartTooltip}
              cursor={{ fill: 'var(--surface-2)' }}
              isAnimationActive={false}
            />
            <Bar
              dataKey="value"
              maxBarSize={14}
              shape={HorizontalBar}
              isAnimationActive={!prefersReducedMotion()}
              animationDuration={600}
              animationEasing="ease-out"
            >
              <LabelList dataKey="tip" position="right" fill="var(--ink)" fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState title={`No spending in ${monthLabel(month, 'name')} yet.`}>
          Categories appear here as soon as the month has an expense.
        </EmptyState>
      )}
    </ChartSection>
  );
}
