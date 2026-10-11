import styles from './Wordmark.module.css';

/** The app's name with its mark: three ledger lines and one green stroke. */
export function Wordmark() {
  return (
    <span className={styles.wordmark}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          d="M3 6h18M3 12h18M3 18h10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path d="M18 15v6" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      Pocketwise
    </span>
  );
}
