import { useId, useState } from 'react';

import { PAYMENT_METHODS, type CategoryOut } from '@/api/types';
import { Button } from '@/ui/Button';
import { DebouncedInput } from '@/ui/DebouncedInput';
import { Field } from '@/ui/Field';

import styles from './ExpenseFiltersBar.module.css';
import { PAYMENT_METHOD_LABELS } from './expenseForm';
import type { FilterName, FilterProblems, FilterValues } from './filters';

interface ExpenseFiltersBarProps {
  values: FilterValues;
  problems: FilterProblems;
  activeCount: number;
  categories: CategoryOut[];
  onChange: (name: FilterName, value: string) => void;
  onClear: () => void;
}

/** One row of filters above the list. On a phone, everything but the search folds away. */
export function ExpenseFiltersBar({
  values,
  problems,
  activeCount,
  categories,
  onChange,
  onClear,
}: ExpenseFiltersBarProps) {
  const [expanded, setExpanded] = useState(false);
  const moreId = useId();
  // The search is always visible, so it does not count towards the folded filters.
  const foldedCount = activeCount - (values.q ? 1 : 0);

  return (
    <search className={styles.bar} aria-label="Filter expenses">
      <div className={styles.top}>
        <Field label="Search notes" className={styles.search}>
          {(control) => (
            <DebouncedInput
              {...control}
              type="search"
              placeholder="Lunch, rent, cab…"
              maxLength={100}
              value={values.q}
              onCommit={(value) => onChange('q', value)}
            />
          )}
        </Field>
        <Button
          className={styles.toggle}
          aria-expanded={expanded}
          aria-controls={moreId}
          onClick={() => setExpanded((open) => !open)}
        >
          Filters{foldedCount > 0 ? ` (${foldedCount})` : ''}
        </Button>
      </div>

      <div id={moreId} className={`${styles.more} ${expanded ? styles.open : ''}`}>
        <Field label="Category">
          {(control) => (
            <select
              {...control}
              value={values.category}
              onChange={(event) => onChange('category', event.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="From" error={problems.dates}>
          {(control) => (
            <input
              {...control}
              type="date"
              value={values.from}
              onChange={(event) => onChange('from', event.target.value)}
            />
          )}
        </Field>

        <Field label="To">
          {(control) => (
            <input
              {...control}
              type="date"
              value={values.to}
              aria-invalid={problems.dates ? true : undefined}
              onChange={(event) => onChange('to', event.target.value)}
            />
          )}
        </Field>

        <Field label="Min amount" error={problems.amounts}>
          {(control) => (
            <DebouncedInput
              {...control}
              inputMode="decimal"
              placeholder="0"
              value={values.min}
              onCommit={(value) => onChange('min', value)}
            />
          )}
        </Field>

        <Field label="Max amount">
          {(control) => (
            <DebouncedInput
              {...control}
              inputMode="decimal"
              placeholder="Any"
              value={values.max}
              aria-invalid={problems.amounts ? true : undefined}
              onCommit={(value) => onChange('max', value)}
            />
          )}
        </Field>

        <Field label="Paid by">
          {(control) => (
            <select
              {...control}
              value={values.method}
              onChange={(event) => onChange('method', event.target.value)}
            >
              <option value="">Any method</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      {activeCount > 0 && (
        <Button variant="quiet" small className={styles.clear} onClick={onClear}>
          Clear filters
        </Button>
      )}
    </search>
  );
}
