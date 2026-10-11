import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ThemeContext, type Theme } from './themeContext';

/** Also read by the inline script in index.html, which applies the theme before first paint. */
const STORAGE_KEY = 'pocket-wise.theme';

function initialTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

/** Ink (dark) is the default. The choice is a preference, not sensitive, so it lives in localStorage. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Storage is blocked: the choice lasts until the page reloads.
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
