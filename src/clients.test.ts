import { describe, expect, it } from 'vitest';
import { CLIENTS, detectClient } from './clients';

describe('detectClient', () => {
  it('detects CarBitLink by filename', () => {
    expect(detectClient('carbitlink-6.5.1-patched-v12.apk')).toBe(CLIENTS.carbitlink);
  });

  it('detects Yilian by filename', () => {
    expect(detectClient('yilian-13.3-patched-v14-signed.apk')).toBe(CLIENTS.yilian);
  });

  it('is case-insensitive', () => {
    expect(detectClient('CARBITLINK-6.5.1.apk')).toBe(CLIENTS.carbitlink);
    expect(detectClient('Yilian-13.3.apk')).toBe(CLIENTS.yilian);
  });

  it('returns null for unknown names', () => {
    expect(detectClient('some-app.apk')).toBeNull();
    expect(detectClient('')).toBeNull();
  });

  it('prefers carbitlink when both keywords appear', () => {
    expect(detectClient('carbitlink-yilian.apk')).toBe(CLIENTS.carbitlink);
  });
});

describe('client definitions', () => {
  it('use distinct packages', () => {
    expect(CLIENTS.carbitlink.pkg).toBe('net.easyconn.carman.wws');
    expect(CLIENTS.yilian.pkg).toBe('net.easyconn.carman');
  });

  it('scope the accessibility service to their own package', () => {
    for (const client of Object.values(CLIENTS)) {
      expect(client.accessibilityService.startsWith(`${client.pkg}/`)).toBe(true);
      expect(client.notificationListener.startsWith(`${client.pkg}/`)).toBe(true);
    }
  });
});
