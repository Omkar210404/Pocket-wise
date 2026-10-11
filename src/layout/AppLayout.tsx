import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';

import { isDemo } from '@/env';
import { LoadingState } from '@/ui/States';

import styles from './AppLayout.module.css';
import { Masthead } from './Masthead';

/** The frame around every logged-in page: skip link, masthead, main area. */
export function AppLayout() {
  return (
    <div className={styles.frame}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <Masthead />
      <main id="main" className={styles.main} tabIndex={-1}>
        <Suspense fallback={<LoadingState rows={6} label="Loading page" />}>
          <Outlet />
        </Suspense>
      </main>
      {isDemo && (
        <footer className={styles.footer}>
          Demo mode: every expense here is fictional and generated in your browser. Changes are lost
          when the page reloads.
        </footer>
      )}
    </div>
  );
}
