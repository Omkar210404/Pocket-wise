import { errorMessage } from '@/api/errors';
import type { ExpenseOut } from '@/api/types';
import { formatDate } from '@/lib/dates';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Money } from '@/ui/Money';
import { ErrorNote } from '@/ui/States';
import { useToast } from '@/ui/toastContext';

import styles from './ExpensePanel.module.css';
import { useDeleteExpense } from './queries';

interface DeleteExpenseDialogProps {
  /** The expense to delete, or null when the dialog is closed. */
  expense: ExpenseOut | null;
  onClose: () => void;
}

/** Deleting cannot be undone, so it asks first and says exactly what will go. */
export function DeleteExpenseDialog({ expense, onClose }: DeleteExpenseDialogProps) {
  const remove = useDeleteExpense();
  const { notify } = useToast();

  function close() {
    remove.reset();
    onClose();
  }

  async function confirm() {
    if (!expense) return;
    try {
      await remove.mutateAsync(expense.id);
      notify('Expense deleted');
      close();
    } catch {
      // The message is shown from `remove.error` below.
    }
  }

  return (
    <Dialog open={expense !== null} onClose={close} title="Delete this expense?" variant="confirm">
      {expense && (
        <div className={styles.confirm}>
          <p className={styles.summary}>
            <span>
              {expense.note ?? expense.category_name}, {formatDate(expense.date)}
            </span>
            <Money amount={expense.amount} />
          </p>
          <p>This cannot be undone.</p>
          {remove.isError && <ErrorNote>{errorMessage(remove.error)}</ErrorNote>}
          <div className={styles.buttons}>
            <Button danger busy={remove.isPending} onClick={() => void confirm()}>
              Delete expense
            </Button>
            <Button variant="quiet" data-autofocus onClick={close} disabled={remove.isPending}>
              Keep it
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
