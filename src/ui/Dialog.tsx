import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';

import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** `panel` slides in from the right. `confirm` is a small centred box. */
  variant?: 'panel' | 'confirm';
  children: ReactNode;
}

/**
 * A modal built on the native <dialog>, so the focus trap, Esc to close and
 * the backdrop come from the browser instead of being re-implemented here.
 */
export function Dialog({ open, onClose, title, variant = 'panel', children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // A click on the dialog element itself is a click on the backdrop: the
  // content sits in an inner element that covers the whole box.
  function closeOnBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === ref.current) onClose();
  }

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${styles[variant]}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={closeOnBackdrop}
    >
      {open && (
        <div className={styles.body}>
          <header className={styles.header}>
            <h2 id={titleId}>{title}</h2>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
