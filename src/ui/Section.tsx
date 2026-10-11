import type { ReactNode } from 'react';

import styles from './Section.module.css';

interface SectionProps {
  /** The small uppercase line above the title. */
  label?: string;
  title: string;
  /** Controls on the right of the heading, such as a "Table" switch. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** A ruled section: a heading and content, with no box around it. */
export function Section({ label, title, actions, className, children }: SectionProps) {
  return (
    <section className={[styles.section, className].filter(Boolean).join(' ')}>
      <header className={styles.header}>
        <div>
          {label && <p className="label">{label}</p>}
          <h2>{title}</h2>
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      {children}
    </section>
  );
}
