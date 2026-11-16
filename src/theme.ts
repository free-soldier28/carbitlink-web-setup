// Theme: light/dark. Default follows the system (prefers-color-scheme);
// manual choice persists in localStorage.

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'carbitlink-web-setup.theme';

export function detectTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
}
