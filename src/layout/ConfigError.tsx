import styles from './ConfigError.module.css';
import { Wordmark } from './Wordmark';

/** Shown instead of the app when it is in normal mode and has no API address. */
export function ConfigError() {
  return (
    <main className={styles.page}>
      <Wordmark />
      <h1>The app does not know where the API is.</h1>
      <p>
        <code>VITE_API_URL</code> is not set. Choose one:
      </p>
      <ol className={styles.steps}>
        <li>
          <strong>Use your API.</strong> Copy <code>.env.example</code> to <code>.env.local</code>,
          set <code>VITE_API_URL</code> to the address of a running Expense-Tracker-API, and restart{' '}
          <code>npm run dev</code>.
        </li>
        <li>
          <strong>Try it without a backend.</strong> Run <code>npm run dev:demo</code> to use
          fictional data in the browser.
        </li>
      </ol>
    </main>
  );
}
