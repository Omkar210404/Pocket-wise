/**
 * DEMO DATA LAYER. Starts the mock service worker in the browser. This module
 * is loaded with a dynamic import from main.tsx, and only when VITE_DEMO is
 * "true", so none of the demo code is in the normal build's main bundle.
 */

import { setupWorker } from 'msw/browser';

import { apiUrl } from '@/env';

import { DemoDb } from './db';
import { createHandlers } from './handlers';
import { seedDemoDb } from './seed';

/** Long enough to see the loading states, short enough not to feel slow. */
const DEMO_LATENCY_MS = 250;

export async function startDemo(): Promise<void> {
  if (!apiUrl) return;
  const db = new DemoDb();
  seedDemoDb(db);
  const worker = setupWorker(...createHandlers(apiUrl, db, { latencyMs: DEMO_LATENCY_MS }));
  await worker.start({
    // Scripts, styles and fonts are not the mock's business.
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });
}
