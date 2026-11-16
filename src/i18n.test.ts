import { beforeEach, describe, expect, it, vi } from 'vitest';
import { detectLang, saveLang, STRINGS } from './i18n';

function stubNavigator(langs: string[]): void {
  vi.stubGlobal('navigator', { languages: langs, language: langs[0] });
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('detectLang', () => {
  it('prefers the saved manual choice', () => {
    saveLang('ru');
    stubNavigator(['en-US']);
    expect(detectLang()).toBe('ru');
    saveLang('en');
    stubNavigator(['ru']);
    expect(detectLang()).toBe('en');
  });

  it('detects Russian from the browser languages list', () => {
    stubNavigator(['en-US', 'ru']);
    expect(detectLang()).toBe('ru');
    stubNavigator(['ru-RU', 'en-US']);
    expect(detectLang()).toBe('ru');
  });

  it('detects English as the first language', () => {
    stubNavigator(['en-US', 'ru']);
    expect(detectLang()).toBe('en');
    stubNavigator(['en']);
    expect(detectLang()).toBe('en');
  });

  it('falls back to English for unknown languages', () => {
    stubNavigator(['de-DE', 'fr']);
    expect(detectLang()).toBe('en');
    stubNavigator([]);
    expect(detectLang()).toBe('en');
  });

  it('checks entries in order (first supported wins)', () => {
    stubNavigator(['de-DE', 'ru-RU', 'en-US']);
    expect(detectLang()).toBe('ru');
  });
});

describe('saveLang', () => {
  it('persists the choice to localStorage', () => {
    saveLang('ru');
    expect(localStorage.getItem('carbitlink-web-setup.lang')).toBe('ru');
    saveLang('en');
    expect(localStorage.getItem('carbitlink-web-setup.lang')).toBe('en');
  });
});

describe('STRINGS', () => {
  it('defines the same UI keys for both languages', () => {
    expect(Object.keys(STRINGS.ru).sort()).toEqual(Object.keys(STRINGS.en).sort());
  });

  it('defines the same step names for both languages', () => {
    expect(STRINGS.ru.steps).toHaveLength(STRINGS.en.steps.length);
  });
});
