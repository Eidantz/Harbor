import { useEffect, type ReactNode } from 'react';
import { applyDocumentTheme, DEFAULT_THEME } from './themes';

/** Applies the default catalog theme; project routes override via applyDocumentTheme. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyDocumentTheme(DEFAULT_THEME);
  }, []);

  return children;
}
