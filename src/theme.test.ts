import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detectTheme, saveTheme } from './theme';

function stubMatchMedia(dark: boolean): void {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: dark }));
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('detectTheme', () => {
  it('prefers the saved manual choice', () => {
    saveTheme('dark');
    stubMatchMedia(false);
    expect(detectTheme()).toBe('dark');
    saveTheme('light');
    stubMatchMedia(true);
    expect(detectTheme()).toBe('light');
  });

  it('follows the system dark preference', () => {
    stubMatchMedia(true);
    expect(detectTheme()).toBe('dark');
  });

  it('follows the system light preference', () => {
    stubMatchMedia(false);
    expect(detectTheme()).toBe('light');
  });

  it('defaults to light when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(detectTheme()).toBe('light');
  });
});

describe('saveTheme', () => {
  it('persists the choice to localStorage', () => {
    saveTheme('dark');
    expect(localStorage.getItem('carbitlink-web-setup.theme')).toBe('dark');
    saveTheme('light');
    expect(localStorage.getItem('carbitlink-web-setup.theme')).toBe('light');
  });
});
