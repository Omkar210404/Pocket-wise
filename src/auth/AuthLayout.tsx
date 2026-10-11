import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { DemoBadge } from '@/layout/DemoBadge';
import { Wordmark } from '@/layout/Wordmark';
import { ThemeToggle } from '@/theme/ThemeToggle';

import { useAuth } from './authContext';
import styles from './AuthLayout.module.css';
import type { LoginLocationState } from './ProtectedRoute';

const POINTS = [
  'Every expense in one searchable list',
  'A budget for each category, month by month',
  'Trends, a category breakdown and a CSV export',
];

/** The frame around the login and register pages. A logged-in user is sent on into the app. */
export function AuthLayout() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (isAuthenticated) {
    const from = (location.state as LoginLocationState | null)?.from;
    return <Navigate to={from ?? '/'} replace />;
  }

  return (
    <div className={styles.page}>
      <aside className={styles.brand}>
        <Wordmark />
        <div className={styles.pitch}>
          <p className={styles.headline}>Know where the month went.</p>
          <ol className={styles.points}>
            {POINTS.map((point, index) => (
              <li key={point}>
                <span className={`${styles.number} money`}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                {point}
              </li>
            ))}
          </ol>
        </div>
      </aside>

      <div className={styles.side}>
        <div className={styles.tools}>
          <DemoBadge />
          <ThemeToggle />
        </div>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
