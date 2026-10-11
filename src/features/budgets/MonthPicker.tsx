import { addMonths, currentMonth, monthLabel } from '@/lib/dates';
import { Button } from '@/ui/Button';

import styles from './MonthPicker.module.css';

interface MonthPickerProps {
  month: string;
  onChange: (month: string) => void;
}

/** Steps through months one at a time, with a way straight back to the current one. */
export function MonthPicker({ month, onChange }: MonthPickerProps) {
  const thisMonth = currentMonth();

  return (
    <div className={styles.picker} role="group" aria-label="Month">
      {month !== thisMonth && (
        <Button variant="quiet" small onClick={() => onChange(thisMonth)}>
          This month
        </Button>
      )}
      <Button
        small
        aria-label={`Previous month, ${monthLabel(addMonths(month, -1))}`}
        onClick={() => onChange(addMonths(month, -1))}
      >
        <span aria-hidden="true">←</span>
      </Button>
      <p className={styles.month} aria-live="polite">
        {monthLabel(month)}
      </p>
      <Button
        small
        aria-label={`Next month, ${monthLabel(addMonths(month, 1))}`}
        onClick={() => onChange(addMonths(month, 1))}
      >
        <span aria-hidden="true">→</span>
      </Button>
    </div>
  );
}
