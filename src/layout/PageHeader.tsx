import type { ReactNode } from 'react';

import styles from './PageHeader.module.css';

interface PageHeaderProps {
  /** The small uppercase line above the title, such as the month. */
  label?: string;
  title: string;
  /** One sentence under the title. */
  lead?: ReactNode;
  /** The page's actions, on the right. */
  actions?: ReactNode;
}

/** The head of a page: title on the left, actions on the right, a heavy rule below. */
export function PageHeader({ label, title, lead, actions }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.text}>
        {label && <p className="label">{label}</p>}
        <h1>{title}</h1>
        {lead && <p className={styles.lead}>{lead}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
