import { meterState } from '@/features/budgets/progress';

import styles from './Meter.module.css';

interface MeterProps {
  /** Spent as a percentage of the budget. May be above 100. Null when there is no budget. */
  percent: number | null;
  /** What the meter measures, for screen readers. For example "Food budget". */
  label: string;
}

/** A thin budget bar. The fill colour carries the state; the words beside it say it too. */
export function Meter({ percent, label }: MeterProps) {
  const { fill, tone } = meterState(percent);
  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fill)}
      aria-valuetext={percent === null ? 'No budget set' : `${percent}% used`}
    >
      <div className={`${styles.fill} ${styles[tone]}`} style={{ width: `${fill}%` }} />
    </div>
  );
}
