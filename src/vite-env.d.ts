/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Expense-Tracker-API. Required unless VITE_DEMO is "true". */
  readonly VITE_API_URL?: string;
  /** "true" runs the app on synthetic in-browser data. */
  readonly VITE_DEMO?: string;
  /** ISO 4217 code used to format amounts. Display only. */
  readonly VITE_CURRENCY?: string;
  /** Tests only: a running Expense-Tracker-API to compare the demo layer against. */
  readonly VITE_REAL_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
