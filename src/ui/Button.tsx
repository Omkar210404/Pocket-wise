import type { ButtonHTMLAttributes } from 'react';

import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'quiet';

interface ButtonStyle {
  variant?: Variant;
  /** Destructive actions are secondary or quiet in the danger colour, never a filled red. */
  danger?: boolean;
  small?: boolean;
}

/** The class for something that should look like a button, such as a router link. */
export function buttonClass({ variant = 'secondary', danger, small }: ButtonStyle = {}): string {
  return [styles.button, styles[variant], danger && styles.danger, small && styles.small]
    .filter(Boolean)
    .join(' ');
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonStyle & {
    /** Shows the button as working and blocks a second press. */
    busy?: boolean;
  };

export function Button({
  variant,
  danger,
  small,
  busy,
  disabled,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[buttonClass({ variant, danger, small }), className].filter(Boolean).join(' ')}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {children}
    </button>
  );
}
