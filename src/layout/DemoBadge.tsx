import { isDemo } from '@/env';

import styles from './DemoBadge.module.css';

/** Always on screen in demo mode, so synthetic data is never mistaken for real data. */
export function DemoBadge() {
  if (!isDemo) return null;
  return (
    <span
      className={styles.badge}
      title="Fictional expenses generated in your browser. Nothing is sent to a server."
    >
      Demo data
    </span>
  );
}
