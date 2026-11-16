import { describe, expect, it } from 'vitest';
import { assertPmSuccess, parseCreateSessionId } from './install';

describe('parseCreateSessionId', () => {
  it('parses the older "Success: [id]" format', () => {
    expect(parseCreateSessionId('Success: [123456]')).toBe('123456');
  });

  it('parses the newer "created install session" format (Android 14+)', () => {
    expect(parseCreateSessionId('Success: created install session [1595418249]'))
      .toBe('1595418249');
  });

  it('is case-insensitive on the Success keyword', () => {
    expect(parseCreateSessionId('success: created install session [42]')).toBe('42');
  });

  it('accepts extra whitespace and surrounding output', () => {
    expect(parseCreateSessionId('  Success:\ncreated install session [7]\n')).toBe('7');
  });

  it('throws when the command failed', () => {
    expect(() => parseCreateSessionId('Error: no devices/emulators found'))
      .toThrow('install-create failed');
  });

  it('throws when Success has no session id', () => {
    expect(() => parseCreateSessionId('Success but no id here'))
      .toThrow('no session id');
  });
});

describe('assertPmSuccess', () => {
  it('passes on plain "Success"', () => {
    expect(() => assertPmSuccess('Success', 'install-write')).not.toThrow();
  });

  it('throws with the step name on failure', () => {
    expect(() => assertPmSuccess('Exception: Bad session id', 'install-commit'))
      .toThrow('install-commit failed');
  });
});
