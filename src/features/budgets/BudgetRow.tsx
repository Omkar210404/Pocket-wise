import { useId, useState, type FormEvent } from 'react';

import { errorMessage } from '@/api/errors';
import { formatMoney, parseAmountInput } from '@/lib/money';
import { Button } from '@/ui/Button';
import { Meter } from '@/ui/Meter';
import { Money } from '@/ui/Money';
import { useToast } from '@/ui/toastContext';

import styles from './BudgetsPage.module.css';
import { useDeleteBudget, useSaveBudget } from './queries';
import { budgetStanding, type BudgetRowData } from './rows';

interface BudgetRowProps {
  row: BudgetRowData;
  month: string;
}

/** One category: its budget in an input that saves on Enter or "Save", and how the month is going. */
export function BudgetRow({ row, month }: BudgetRowProps) {
  const saved = row.budget ?? '';
  const [text, setText] = useState(saved);
  const [seenSaved, setSeenSaved] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const save = useSaveBudget(month);
  const remove = useDeleteBudget();
  const { notify } = useToast();
  const inputId = useId();
  const errorId = useId();

  // The saved budget changed (a save, a removal, another month): show it.
  if (saved !== seenSaved) {
    setSeenSaved(saved);
    setText(saved);
  }

  const dirty = text.trim() !== saved;
  const standing = budgetStanding(row);
  const busy = save.isPending || remove.isPending;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const amount = parseAmountInput(text);
    if (!amount.ok) {
      setError(amount.message);
      return;
    }
    setError(null);
    if (amount.value === saved) {
      setText(saved);
      return;
    }
    try {
      await save.mutateAsync({
        category_id: row.category_id,
        budget_id: row.budget_id,
        amount: amount.value,
      });
      notify(`${row.name} budget set to ${formatMoney(amount.value)}`);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  async function removeBudget() {
    if (row.budget_id === null) return;
    setError(null);
    try {
      await remove.mutateAsync(row.budget_id);
      notify(`${row.name} budget removed`);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <tr>
      <th scope="row" className={styles.name}>
        {row.name}
      </th>
      <td className={styles.spent}>
        <span className={styles.cellLabel}>Spent </span>
        <Money amount={row.spent} />
      </td>
      <td className={styles.budget}>
        <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
          <label htmlFor={inputId} className="visually-hidden">
            {row.name} budget for the month
          </label>
          <input
            id={inputId}
            className={`${styles.input} money`}
            inputMode="decimal"
            autoComplete="off"
            placeholder="No budget"
            value={text}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setText(event.target.value);
              setError(null);
            }}
          />
          <Button type="submit" small disabled={!dirty || busy} busy={save.isPending}>
            Save
          </Button>
        </form>
        {error && (
          <p id={errorId} className={styles.error} role="alert">
            {error}
          </p>
        )}
      </td>
      <td className={styles.standing}>
        {row.budget !== null ? (
          <>
            <Meter percent={row.percent_used} label={`${row.name} budget`} />
            <p className={`${styles.standingText} ${styles[standing.tone] ?? ''}`}>
              <span className="money">{standing.text}</span>
              <span className={`${styles.percent} money`}>{row.percent_used}%</span>
            </p>
          </>
        ) : (
          <p className={styles.none}>No budget this month</p>
        )}
      </td>
      <td className={styles.actions}>
        {row.budget_id !== null && (
          <Button
            variant="quiet"
            small
            danger
            disabled={busy}
            aria-label={`Remove the ${row.name} budget`}
            onClick={() => void removeBudget()}
          >
            Remove
          </Button>
        )}
      </td>
    </tr>
  );
}
