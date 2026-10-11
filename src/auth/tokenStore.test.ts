import { describe, expect, it } from 'vitest';

import { clearSession, getToken, readSession, writeSession } from './tokenStore';

describe('tokenStore', () => {
  it('keeps the session in sessionStorage, not localStorage', () => {
    writeSession({ token: 'abc', expiresAt: Date.now() + 60_000 });

    expect(getToken()).toBe('abc');
    expect(JSON.stringify(window.sessionStorage)).toContain('abc');
    expect(JSON.stringify(window.localStorage)).not.toContain('abc');
  });

  it('treats an expired session as no session and removes it', () => {
    writeSession({ token: 'old', expiresAt: Date.now() - 1 });

    expect(readSession()).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('ignores stored data that is not a session', () => {
    window.sessionStorage.setItem('price-expense-tracker.session', '{"token": 42}');
    expect(readSession()).toBeNull();

    window.sessionStorage.setItem('price-expense-tracker.session', 'not json');
    expect(readSession()).toBeNull();
  });

  it('forgets the session on clear', () => {
    writeSession({ token: 'abc', expiresAt: Date.now() + 60_000 });
    clearSession();
    expect(getToken()).toBeNull();
  });
});
