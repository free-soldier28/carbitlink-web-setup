// Post-install configuration ported from install.ps1:
// runtime permissions, appops, notification listener, battery whitelist,
// accessibility service, launch.

import type { Adb } from '@yume-chan/adb';
import { shell, shellBestEffort, shellText } from './connection';
import type { ClientDef } from '../clients';
import { RUNTIME_PERMISSIONS } from '../clients';

export interface GrantResult {
  permissionsGranted: number;
  permissionsTotal: number;
}

export async function grantRuntimePermissions(adb: Adb, client: ClientDef): Promise<GrantResult> {
  let granted = 0;
  for (const perm of RUNTIME_PERMISSIONS) {
    const result = await shell(adb, `pm grant --user 0 ${client.pkg} ${perm}`)
      .catch(() => null);
    // exitCode === 0 → granted; failures (unknown permission on this Android) are fine
    if (result && result.exitCode === 0) granted++;
  }
  return { permissionsGranted: granted, permissionsTotal: RUNTIME_PERMISSIONS.length };
}

export async function grantAppops(adb: Adb, client: ClientDef): Promise<void> {
  await shellBestEffort(adb, `appops set --user 0 ${client.pkg} android:get_usage_stats allow`);
  await shellBestEffort(adb, `appops set --user 0 ${client.pkg} SYSTEM_ALERT_WINDOW allow`);
  await shellBestEffort(adb, `appops set --user 0 ${client.pkg} WRITE_SETTINGS allow`);
  await shellBestEffort(adb, `appops set --user 0 ${client.pkg} PROJECT_MEDIA allow`);
}

export async function enableNotificationListener(adb: Adb, client: ClientDef): Promise<void> {
  await shellBestEffort(adb, `cmd notification allow_listener ${client.notificationListener}`);
}

export async function addToBatteryWhitelist(adb: Adb, client: ClientDef): Promise<void> {
  await shellBestEffort(adb, `dumpsys deviceidle whitelist +${client.pkg}`);
}

// Merge a service into the enabled_accessibility_services value (colon-separated).
// Empty or literal "null" → just the service; already present → unchanged.
export function mergeAccessibilityService(current: string, service: string): string {
  const cur = current.trim();
  if (!cur || cur === 'null') return service;
  if (cur.split(':').includes(service)) return cur;
  return `${cur}:${service}`;
}

export async function enableAccessibility(adb: Adb, client: ClientDef): Promise<void> {
  const cur = await shellText(adb, 'settings get secure enabled_accessibility_services');
  const next = mergeAccessibilityService(cur, client.accessibilityService);
  await shellBestEffort(adb, `settings put secure enabled_accessibility_services ${next}`);
  await shellBestEffort(adb, 'settings put secure accessibility_enabled 1');
}

export async function launchApp(adb: Adb, client: ClientDef): Promise<void> {
  await shellBestEffort(adb, `monkey -p ${client.pkg} -c android.intent.category.LAUNCHER 1`);
}

// True when the accessibility service got bound (touch-back ready).
export async function verifyAccessibility(adb: Adb, client: ClientDef): Promise<boolean> {
  const dump = await shellText(adb, 'dumpsys accessibility').catch(() => '');
  return dump.includes(client.accessibilityService);
}
