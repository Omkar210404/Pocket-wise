/**
 * The fake API for tests: the demo handlers, served by MSW in Node. Every test
 * starts with a freshly seeded database, and "today" is fixed (see setup.ts).
 */

import { setupServer } from 'msw/node';

import { writeSession } from '@/auth/tokenStore';
import { DemoDb } from '@/demo/db';
import { createHandlers } from '@/demo/handlers';
import { DEMO_EMAIL, DEMO_PASSWORD, seedDemoDb } from '@/demo/seed';

/** Must match VITE_API_URL in vite.config.ts. */
export const API_URL = 'http://api.test';

/** Every test runs on this day: 15 June 2026, mid-morning, local time. */
export const TEST_NOW = new Date(2026, 5, 15, 10, 0, 0);
export const TEST_MONTH = '2026-06';

export const server = setupServer();

let currentDb: DemoDb | null = null;

/** The database behind the fake API in the running test. */
export function db(): DemoDb {
  if (!currentDb) throw new Error('The test database is not set up yet.');
  return currentDb;
}

export function resetDb(): void {
  currentDb = new DemoDb();
  seedDemoDb(currentDb);
  server.resetHandlers(...createHandlers(API_URL, currentDb));
}

/** Stores a valid session for the seeded demo account, as a login would. */
export function signIn(): string {
  const token = db().login(DEMO_EMAIL, DEMO_PASSWORD);
  writeSession({
    token: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  });
  return token.access_token;
}

/** The demo account's id, for reading the database directly in assertions. */
export function demoUserId(): number {
  return db().authenticate(`Bearer ${db().login(DEMO_EMAIL, DEMO_PASSWORD).access_token}`);
}
