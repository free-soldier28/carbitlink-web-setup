import { describe, expect, it } from 'vitest';
import { mergeAccessibilityService } from './grants';

const SVC = 'net.easyconn.carman.wws/net.easyconn.carman.accessibility.AccessibilityResultService';

describe('mergeAccessibilityService', () => {
  it('returns just the service when the setting is empty', () => {
    expect(mergeAccessibilityService('', SVC)).toBe(SVC);
  });

  it('returns just the service when the setting is "null"', () => {
    expect(mergeAccessibilityService('null', SVC)).toBe(SVC);
  });

  it('treats whitespace-only as empty', () => {
    expect(mergeAccessibilityService('  ', SVC)).toBe(SVC);
  });

  it('appends to an existing value', () => {
    expect(mergeAccessibilityService('com.other/Service', SVC))
      .toBe(`com.other/Service:${SVC}`);
  });

  it('keeps the value unchanged when the service is already present', () => {
    expect(mergeAccessibilityService(SVC, SVC)).toBe(SVC);
  });

  it('matches the service only as a whole entry, not a substring', () => {
    const prefix = `${SVC}-suffix`;
    expect(mergeAccessibilityService(prefix, SVC)).toBe(`${prefix}:${SVC}`);
  });
});
