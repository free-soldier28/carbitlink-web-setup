import { beforeEach, describe, expect, it, vi } from 'vitest';
import { countGrantedPermissions, mergeAccessibilityService, waitForAccessibility } from './grants';
import type { ClientDef } from '../clients';

const shellTextMock = vi.fn<(adb: never, command: string) => Promise<string>>();
vi.mock('./connection', () => ({
  shell: vi.fn(async () => ({ stdout: '', exitCode: 0 })),
  shellBestEffort: vi.fn(async () => undefined),
  shellText: (adb: never, command: string) => shellTextMock(adb, command),
}));

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

describe('countGrantedPermissions', () => {
  it('counts only granted=true entries in the User 0 runtime section', () => {
    const dump = `
    User 0: ceDataInode=0
      runtime permissions:
        android.permission.RECORD_AUDIO: granted=true, flags=[ USER_SENSITIVE ]
        android.permission.ACCESS_FINE_LOCATION: granted=false, flags=[ USER_SENSITIVE ]
        android.permission.POST_NOTIFICATIONS: granted=true, flags=[ USER_SENSITIVE ]
        android.permission.CALL_PHONE: granted=true
    User 999: ceDataInode=0
      runtime permissions:
        android.permission.RECORD_AUDIO: granted=false, flags=[ RESTRICTION_INSTALLER_EXEMPT]
    `;
    expect(countGrantedPermissions(dump)).toBe(3);
  });

  it('returns zero when there is no runtime section', () => {
    expect(countGrantedPermissions('no permissions here')).toBe(0);
  });
});

describe('waitForAccessibility', () => {
  const client = { accessibilityService: SVC } as ClientDef;
  const adb = {} as never;

  beforeEach(() => {
    shellTextMock.mockReset();
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => {
      fn();
      return 0 as never;
    }) as never);
  });

  it('returns true as soon as the service appears in dumpsys', async () => {
    shellTextMock
      .mockResolvedValueOnce('Enabled services:{}')
      .mockResolvedValueOnce(`Bound services:{Service[${SVC}]}`);
    expect(await waitForAccessibility(adb, client, 3, 0)).toBe(true);
    expect(shellTextMock).toHaveBeenCalledTimes(2);
  });

  it('polls up to the attempt limit when the service never binds', async () => {
    shellTextMock.mockResolvedValue('Enabled services:{}');
    expect(await waitForAccessibility(adb, client, 3, 0)).toBe(false);
    expect(shellTextMock).toHaveBeenCalledTimes(3);
  });
});
