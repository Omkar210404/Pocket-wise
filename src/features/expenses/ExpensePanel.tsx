import { useState, type FormEvent } from 'react';

import { fieldErrors, errorMessage } from '@/api/errors';
import type { CategoryOut, ExpenseOut } from '@/api/types';
import { PAYMENT_METHODS } from '@/api/types';
import { nextDay, todayIso } from '@/lib/dates';
import { currencySymbol } from '@/lib/money';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Field } from '@/ui/Field';
import { ErrorNote, ErrorState, LoadingState } from '@/ui/States';
import { useToast } from '@/ui/toastContext';

import { useCategories } from '../categories';
import {
  changedFields,
  emptyExpenseForm,
  formFromExpense,
  MAX_NOTE_LENGTH,
  PAYMENT_METHOD_LABELS,
  serverFieldErrors,
  validateExpenseForm,
  type ExpenseFormErrors,
  type ExpenseFormValues,
} from './expenseForm';
import styles from './ExpensePanel.module.css';
import { useCreateExpense, useUpdateExpense } from './queries';

/** What the panel is open for. Null means closed. */
export type PanelTarget = { kind: 'new' } | { kind: 'edit'; expense: ExpenseOut };

interface ExpenseFormProps {
  target: PanelTarget;
  categories: CategoryOut[];
  onDone: () => void;
}

function ExpenseForm({ target, categories, onDone }: ExpenseFormProps) {
  const today = todayIso();
  const original = target.kind === 'edit' ? target.expense : null;
  const [values, setValues] = useState<ExpenseFormValues>(() =>
    original ? formFromExpense(original) : emptyExpenseForm(today),
  );
  const [errors, setErrors] = useState<ExpenseFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const create = useCreateExpense();
  const update = useUpdateExpense();
  const { notify } = useToast();
  const saving = create.isPending || update.isPending;

  function set(name: keyof ExpenseFormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    // A field stops being marked wrong as soon as it is edited.
    if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setFormError(null);

    const result = validateExpenseForm(values, today);
    if (!result.ok) {
      setErrors(result.errors);
      // Put the cursor in the first field that needs fixing, once it is marked.
      requestAnimationFrame(() =>
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }

    try {
      if (original) {
        const changes = changedFields(original, result.payload);
        if (Object.keys(changes).length > 0) {
          await update.mutateAsync({ id: original.id, changes });
          notify('Expense updated');
        }
      } else {
        await create.mutateAsync(result.payload);
        notify('Expense added');
      }
      onDone();
    } catch (error) {
      // A 422 names its fields: show each message under its own control.
      const fromServer = serverFieldErrors(fieldErrors(error));
      if (Object.keys(fromServer).length > 0) setErrors(fromServer);
      else setFormError(errorMessage(error));
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
      {formError && <ErrorNote>{formError}</ErrorNote>}

      <Field label={`Amount (${currencySymbol()})`} error={errors.amount}>
        {(control) => (
          <input
            {...control}
            data-autofocus
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={values.amount}
            onChange={(event) => set('amount', event.target.value)}
          />
        )}
      </Field>

      <div className={styles.pair}>
        <Field label="Date" error={errors.date}>
          {(control) => (
            <input
              {...control}
              type="date"
              min="2000-01-01"
              max={nextDay(today)}
              value={values.date}
              onChange={(event) => set('date', event.target.value)}
            />
          )}
        </Field>

        <Field label="Paid by" error={errors.method}>
          {(control) => (
            <select
              {...control}
              value={values.method}
              onChange={(event) => set('method', event.target.value)}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <Field label="Category" error={errors.category}>
        {(control) => (
          <select
            {...control}
            value={values.category}
            onChange={(event) => set('category', event.target.value)}
          >
            <option value="">Choose a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field
        label="Note (optional)"
        error={errors.note}
        hint={`${values.note.trim().length} of ${MAX_NOTE_LENGTH} characters`}
      >
        {(control) => (
          <textarea
            {...control}
            rows={3}
            value={values.note}
            onChange={(event) => set('note', event.target.value)}
          />
        )}
      </Field>

      <div className={styles.footer}>
        <Button type="submit" variant="primary" busy={saving}>
          {original ? 'Save changes' : 'Add expense'}
        </Button>
        <Button variant="quiet" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

interface ExpensePanelProps {
  target: PanelTarget | null;
  onClose: () => void;
}

/** The side panel for adding or editing one expense. */
export function ExpensePanel({ target, onClose }: ExpensePanelProps) {
  const categories = useCategories();

  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title={target?.kind === 'edit' ? 'Edit expense' : 'Add expense'}
    >
      {target &&
        (categories.isPending ? (
          <LoadingState rows={5} label="Loading categories" />
        ) : categories.isError ? (
          <ErrorState
            title="Could not load your categories"
            error={categories.error}
            onRetry={() => void categories.refetch()}
          />
        ) : (
          <ExpenseForm target={target} categories={categories.data} onDone={onClose} />
        ))}
    </Dialog>
  );
}
