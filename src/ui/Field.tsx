import { useId, type ReactNode } from 'react';

import styles from './Field.module.css';

/** What a control needs to be tied to its label, hint and error. Spread it on the control. */
export interface ControlProps {
  id: string;
  className: string;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
}

interface FieldProps {
  label: string;
  /** Shown under the control in the danger colour and announced with it. */
  error?: string | null;
  hint?: ReactNode;
  /** Hides the label visually. It stays available to screen readers. */
  hideLabel?: boolean;
  className?: string;
  children: (control: ControlProps) => ReactNode;
}

/**
 * A labelled form control. The label is always present, and the error is
 * linked to the control so a screen reader reads it with the field.
 */
export function Field({ label, error, hint, hideLabel, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : `label ${styles.label}`}>
        {label}
      </label>
      {children({
        id,
        className: styles.control ?? '',
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy || undefined,
      })}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
