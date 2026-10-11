import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';

import { setUnauthorizedHandler } from '@/api/client';
import { clearSession } from '@/auth/tokenStore';

import { resetDb, server, TEST_NOW } from './server';

// A request the fake API does not know is a bug in the test or the app.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  // Only the clock is faked, so "today" is the same on every run. Timers stay real.
  vi.useFakeTimers({ toFake: ['Date'], now: TEST_NOW });
  resetDb();
});

afterEach(() => {
  cleanup();
  clearSession();
  setUnauthorizedHandler(null);
  window.sessionStorage.clear();
  window.localStorage.clear();
  vi.useRealTimers();
});

// jsdom has no layout, so it does not implement these. The app only needs them to exist.
if (!('ResizeObserver' in globalThis)) {
  // The chart library measures its container with this.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
