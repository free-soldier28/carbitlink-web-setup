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

// Count permissions actually granted for user 0 in a `pm dump <pkg>` output.
// Reliable across Android versions: the exit code of `pm grant` alone can be
// misleading (already-granted / platform permissions), so the final state is
// read back from the package manager.
export function countGrantedPermissions(dump: string): number {
  const user0 = dump.match(/User 0:[\s\S]*?(?=\n\s*User \d+:|$)/)?.[0] ?? dump;
  const runtime = user0.split('runtime permissions:')[1] ?? '';
  let count = 0;
  for (const perm of RUNTIME_PERMISSIONS) {
    const escaped = perm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b[^\\n]*granted=true`).test(runtime)) count++;
  }
  return count;
}

export async function grantRuntimePermissions(adb: Adb, client: ClientDef): Promise<GrantResult> {
  for (const perm of RUNTIME_PERMISSIONS) {
    // Failures (unknown permission on this Android version) are fine.
    await shell(adb, `pm grant --user 0 ${client.pkg} ${perm}`).catch(() => null);
  }
  const dump = await shellText(adb, `pm dump ${client.pkg}`).catch(() => '');
  return {
    permissionsGranted: countGrantedPermissions(dump),
    permissionsTotal: RUNTIME_PERMISSIONS.length,
  };
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

// Resolve the launcher activity; use it with `am start` (more reliable than
// monkey on modern Android where the app can be in a "stopped" state).
export async function resolveLauncherActivity(adb: Adb, pkg: string): Promise<string | null> {
  const out = await shellText(
    adb,
    `cmd package resolve-activity --brief -c android.intent.category.LAUNCHER ${pkg}`,
  ).catch(() => '');
  const line = out.split('\n').map((s) => s.trim()).find((s) => s.includes('/'));
  return line ?? null;
}

export interface LaunchResult {
  launched: boolean;
  detail: string;
}

export async function launchApp(adb: Adb, client: ClientDef): Promise<LaunchResult> {
  const component = await resolveLauncherActivity(adb, client.pkg);
  let detail = '';
  if (component) {
    const started = await shell(adb, `am start -n ${component}`).catch(() => null);
    detail = `am start: ${started ? started.exitCode : 'no response'}`;
    if (!started || started.exitCode !== 0) {
      const monkey = await shell(
        adb,
        `monkey -p ${client.pkg} -c android.intent.category.LAUNCHER 1`,
      ).catch(() => null);
      detail += `; monkey: ${monkey ? monkey.exitCode : 'no response'}`;
    }
  } else {
    const monkey = await shell(
      adb,
      `monkey -p ${client.pkg} -c android.intent.category.LAUNCHER 1`,
    ).catch(() => null);
    detail = `monkey (no launcher resolved): ${monkey ? monkey.exitCode : 'no response'}`;
  }

  // A freshly installed app can be in a stopped state; give the process time.
  await new Promise((r) => setTimeout(r, 2000));
  const pid = await shellText(adb, `pidof ${client.pkg}`).catch(() => '');
  return {
    launched: pid.trim().length > 0,
    detail: `${detail} (pidof: ${pid.trim() || 'none'})`,
  };
}

// Open the system accessibility page so the user can enable the service when
// Android blocks programmatic enablement (restricted settings on Android 13+).
export async function openAccessibilitySettings(adb: Adb): Promise<void> {
  await shellBestEffort(adb, 'am start -a android.settings.ACCESSIBILITY_SETTINGS');
}

// True when the accessibility service got bound (touch-back ready).
export async function verifyAccessibility(adb: Adb, client: ClientDef): Promise<boolean> {
  const dump = await shellText(adb, 'dumpsys accessibility').catch(() => '');
  return dump.includes(client.accessibilityService);
}

// Binding can lag behind the settings write; poll a few times before giving up.
export async function waitForAccessibility(
  adb: Adb,
  client: ClientDef,
  attempts = 6,
  delayMs = 1000,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (await verifyAccessibility(adb, client)) return true;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}
