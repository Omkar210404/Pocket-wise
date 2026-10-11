/** Build-time configuration. It all comes from VITE_ variables; no URL is hardcoded. */

export const isDemo = import.meta.env.VITE_DEMO === 'true';

function resolveApiUrl(): string | null {
  // Demo mode never talks to a backend. The mock service worker answers under
  // this same-origin prefix, whatever VITE_API_URL says.
  if (isDemo) return `${window.location.origin}/demo-api`;
  const url = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '');
  return url || null;
}

/** Null when the app is in normal mode and VITE_API_URL is not set. */
export const apiUrl = resolveApiUrl();

export const currency = import.meta.env.VITE_CURRENCY?.trim() || 'INR';
