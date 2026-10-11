import type { ExpenseOut, ExpenseSort, SortOrder } from '@/api/types';
import { formatDate } from '@/lib/dates';
import { Button } from '@/ui/Button';
import { Money } from '@/ui/Money';

import { PAYMENT_METHOD_LABELS } from './expenseForm';
import styles from './ExpenseTable.module.css';

interface ExpenseTableProps {
  items: ExpenseOut[];
  sort: ExpenseSort;
  order: SortOrder;
  onSort: (sort: ExpenseSort) => void;
  onEdit: (expense: ExpenseOut) => void;
  onDelete: (expense: ExpenseOut) => void;
  /** True while newer rows are loading: the current ones stay, dimmed. */
  stale?: boolean;
}

interface SortHeaderProps {
  column: ExpenseSort;
  label: string;
  sort: ExpenseSort;
  order: SortOrder;
  onSort: (sort: ExpenseSort) => void;
  numeric?: boolean;
}

function SortHeader({ column, label, sort, order, onSort, numeric }: SortHeaderProps) {
  const active = sort === column;
  return (
    <th
      scope="col"
      className={numeric ? styles.numeric : undefined}
      aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" className={styles.sort} onClick={() => onSort(column)}>
        {label}
        <span className={styles.arrow} aria-hidden="true">
          {active ? (order === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}

/** What an expense is called in a button's accessible name. */
function describe(expense: ExpenseOut): string {
  return `${expense.note ?? expense.category_name}, ${formatDate(expense.date)}`;
}

/** The ledger itself. A table on wide screens; on a phone each row becomes a small block. */
export function ExpenseTable({
  items,
  sort,
  order,
  onSort,
  onEdit,
  onDelete,
  stale,
}: ExpenseTableProps) {
  return (
    <table className={`${styles.table} ${stale ? styles.stale : ''}`}>
      <caption className="visually-hidden">Expenses</caption>
      <thead>
        <tr>
          <SortHeader column="date" label="Date" sort={sort} order={order} onSort={onSort} />
          <th scope="col">Note</th>
          <th scope="col">Category</th>
          <th scope="col">Paid by</th>
          <SortHeader
            column="amount"
            label="Amount"
            sort={sort}
            order={order}
            onSort={onSort}
            numeric
          />
          <th scope="col">
            <span className="visually-hidden">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((expense) => (
          <tr key={expense.id}>
            <td className={`${styles.date} money`}>{formatDate(expense.date)}</td>
            <td className={styles.note}>
              {expense.note ?? <span className={styles.none}>No note</span>}
            </td>
            <td className={styles.category}>{expense.category_name}</td>
            <td className={styles.method}>{PAYMENT_METHOD_LABELS[expense.payment_method]}</td>
            <td className={`${styles.amount} ${styles.numeric}`}>
              <Money amount={expense.amount} />
            </td>
            <td className={styles.actions}>
              <Button
                variant="quiet"
                small
                aria-label={`Edit ${describe(expense)}`}
                onClick={() => onEdit(expense)}
              >
                Edit
              </Button>
              <Button
                variant="quiet"
                small
                danger
                aria-label={`Delete ${describe(expense)}`}
                onClick={() => onDelete(expense)}
              >
                Delete
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
