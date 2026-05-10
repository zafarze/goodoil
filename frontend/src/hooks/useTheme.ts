import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';
const KEY = 'goodoil_theme';

export function getInitialTheme(): Theme {
  const saved = localStorage.getItem(KEY);
  return saved === 'light' || saved === 'dark' ? saved : 'dark';
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(KEY, theme);
}

export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme) || getInitialTheme(),
  );
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const t = (document.documentElement.dataset.theme as Theme) || 'dark';
      setTheme(t);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);
  return theme;
}
