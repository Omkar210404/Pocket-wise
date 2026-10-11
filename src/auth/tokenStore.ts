/**
 * Where the access token lives: sessionStorage.
 *
 * The API has no refresh token, so a token kept only in memory would mean
 * logging in again after every page reload. sessionStorage survives a reload,
 * is not shared with other tabs and is cleared when the tab closes. It is
 * still readable by any script running on the page, exactly like localStorage
 * (see "Where the token is kept" in the README). Changing the storage is a
 * change to this file only.
 */

const STORAGE_KEY = 'pocket-wise.session';

export interface Session {
  token: string;
  /** When the token stops being valid, in milliseconds since the epoch. */
  expiresAt: number;
}

// Used when storage is blocked (some private modes): the session then lasts
// until the page is reloaded.
let memorySession: Session | null = null;

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.token === 'string' && typeof candidate.expiresAt === 'number';
}

/** The stored session, or null when there is none or it has already expired. */
export function readSession(now: number = Date.now()): Session | null {
  let session = memorySession;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      session = isSession(parsed) ? parsed : null;
    }
  } catch {
    // Storage is blocked or holds something unreadable: fall back to memory.
  }
  if (!session) return null;
  if (session.expiresAt <= now) {
    clearSession();
    return null;
  }
  return session;
}

export function writeSession(session: Session): void {
  memorySession = session;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Kept in memory only.
  }
}

export function clearSession(): void {
  memorySession = null;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing was stored.
  }
}

export function getToken(): string | null {
  return readSession()?.token ?? null;
}
