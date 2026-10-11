import { useEffect, useEffectEvent } from 'react';

/** setTimeout cannot wait longer than this (about 24.8 days). */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * Calls `onExpire` when the clock reaches `expiresAt` (milliseconds since the
 * epoch). The API has no refresh token, so when the token runs out the only
 * honest thing to do is log out.
 *
 * A timer alone is not enough: browsers slow timers down in background tabs
 * and stop them while a laptop sleeps. So the expiry is checked again whenever
 * the tab becomes visible or the window gets focus.
 */
export function useSessionExpiry(expiresAt: number | null, onExpire: () => void): void {
  const expire = useEffectEvent(onExpire);

  useEffect(() => {
    if (expiresAt === null) return;
    let timer: number | undefined;

    const check = () => {
      window.clearTimeout(timer);
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        expire();
        return;
      }
      timer = window.setTimeout(check, Math.min(remaining, MAX_TIMEOUT_MS));
    };

    check();
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [expiresAt]);
}
