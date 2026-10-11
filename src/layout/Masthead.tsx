import { Link, NavLink } from 'react-router-dom';

import { useAuth } from '@/auth/authContext';
import { isDemo } from '@/env';
import { ThemeToggle } from '@/theme/ThemeToggle';
import { Button } from '@/ui/Button';

import { DemoBadge } from './DemoBadge';
import styles from './Masthead.module.css';
import { Wordmark } from './Wordmark';

const LINKS = [
  { to: '/', label: 'Overview', end: true },
  { to: '/expenses', label: 'Expenses', end: false },
  { to: '/budgets', label: 'Budgets', end: false },
];

export function Masthead() {
  const { user, logout } = useAuth();

  return (
    <header className={styles.masthead}>
      {/* On a phone the top row has no room for the badge, so it gets a strip of its own. */}
      {isDemo && <p className={styles.strip}>Demo data: fictional expenses</p>}
      <div className={styles.inner}>
        <Link to="/" className={styles.home} aria-label="Expense Tracker, overview">
          <Wordmark />
        </Link>

        <nav className={styles.nav} aria-label="Main">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.tools}>
          <span className={styles.badge}>
            <DemoBadge />
          </span>
          {user && (
            <span className={styles.email} title={user.email}>
              {user.email}
            </span>
          )}
          <ThemeToggle />
          <Button variant="quiet" onClick={logout}>
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
