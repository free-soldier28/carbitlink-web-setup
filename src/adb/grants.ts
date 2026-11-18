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

// `pidof` is missing on some vendor ROMs; `dumpsys activity processes` always
// exists and reports running processes as "Proc #N: ... <pkg>/...".
export function isProcessRunning(procDump: string, pkg: string): boolean {
  return new RegExp(`Proc\\s+#\\d+:[^\\n]*\\b${pkg.replace(/\./g, '\\.')}\\b`).test(procDump);
}

export async function appIsRunning(adb: Adb, pkg: string): Promise<string> {
  const pid = (await shellText(adb, `pidof ${pkg}`).catch(() => '')).trim();
  if (pid) return `pidof: ${pid}`;
  const procDump = await shellText(adb, 'dumpsys activity processes').catch(() => '');
  if (isProcessRunning(procDump, pkg)) return 'dumpsys: running';
  return 'no process';
}

export async function launchApp(adb: Adb, client: ClientDef): Promise<LaunchResult> {
  const component = await resolveLauncherActivity(adb, client.pkg);
  let detail = '';
  if (component) {
    const started = await shell(adb, `am start -n ${component}`).catch(() => null);
    // am start returns 0 even on "Activity not started" — keep the actual output.
    const out = (started?.stdout ?? '').trim().replace(/\s+/g, ' ').slice(0, 300);
    detail = `am start exit=${started ? started.exitCode : 'none'}${out ? ` [${out}]` : ''}`;
    if (!started || started.exitCode !== 0 || /error|not started|denied/i.test(out)) {
      const monkey = await shell(
        adb,
        `monkey -p ${client.pkg} -c android.intent.category.LAUNCHER 1`,
      ).catch(() => null);
      detail += `; monkey=${monkey ? monkey.exitCode : 'none'}`;
    }
  } else {
    const monkey = await shell(
      adb,
      `monkey -p ${client.pkg} -c android.intent.category.LAUNCHER 1`,
    ).catch(() => null);
    detail = `monkey (no launcher resolved)=${monkey ? monkey.exitCode : 'none'}`;
  }

  await new Promise((r) => setTimeout(r, 2500));
  const running = await appIsRunning(adb, client.pkg);
  return { launched: running !== 'no process', detail: `${detail} (${running})` };
}

// Pull the actual crash reason when the app dies right after launch.
export async function collectLaunchDiagnostics(adb: Adb, client: ClientDef): Promise<string> {
  const filter = `(${client.pkg}|AndroidRuntime|FATAL|ActivityManager|AccessibilityService)`;
  const log = await shellText(
    adb,
    `logcat -d -t 200 | grep -iE "${filter}" | tail -60`,
  ).catch(() => '');
  return log.trim() || 'logcat returned no matching lines';
}

// Open the details page for THIS client's accessibility service — the user
// often enables the other client's service by mistake (Yilian vs CarBitLink).
export async function openAccessibilitySettings(adb: Adb, client: ClientDef): Promise<void> {
  const detail = await shell(
    adb,
    `am start -a android.settings.ACCESSIBILITY_DETAILS_SETTINGS -d package:${client.accessibilityService}`,
  ).catch(() => null);
  if (!detail || /error|not found|no activity/i.test(detail.stdout)) {
    await shellBestEffort(adb, 'am start -a android.settings.ACCESSIBILITY_SETTINGS');
  }
}

// On Android 13+ a sideloaded app can be "restricted": its accessibility toggle
// stays disabled until the user allows restricted settings in App info.
export async function openAppInfoSettings(adb: Adb, client: ClientDef): Promise<void> {
  await shellBestEffort(
    adb,
    `am start -a android.settings.APPLICATION_DETAILS_SETTINGS -d package:${client.pkg}`,
  );
}

export async function getAccessibilityDiagnostics(adb: Adb): Promise<string> {
  const setting = await shellText(adb, 'settings get secure enabled_accessibility_services')
    .catch(() => '?');
  const enabled = await shellText(adb, 'settings get secure accessibility_enabled')
    .catch(() => '?');
  const dump = await shellText(adb, 'dumpsys accessibility').catch(() => '');
  const sections = dump.split('\n')
    .filter((line) => /Bound services:|Enabled services:/.test(line))
    .slice(0, 8)
    .join('\n');
  return `a11y setting: ${setting.trim()}\na11y_enabled: ${enabled.trim()}\n${sections}`;
}

// True only when the service is really bound. `dumpsys accessibility` lists
// configured services under "Enabled services" even when the app is dead —
// checking the whole dump gives a false "bound". Look at the Bound section.
export function parseAccessibilityBound(dump: string, service: string): boolean {
  // dumpsys groups data per user/display into "attributes:{...}" blocks, each
  // with its own Bound/Enabled services. Pair them so a bound service from
  // another user cannot be mistaken for ours.
  const blocks = dump.split(/attributes:\{/).slice(1);
  for (const block of blocks) {
    const bound = block.match(/Bound services:\{([\s\S]*?)\}/);
    if (!bound || !/Service\[/i.test(bound[1])) continue;
    const enabled = block.match(/Enabled services:\{([\s\S]*?)\}/);
    if (enabled && enabled[1].includes(service)) return true;
  }
  // Fallback for dump formats without attributes blocks.
  const anyBound = /Bound services:\{([\s\S]*?)\}/.exec(dump);
  return !!anyBound && /Service\[/i.test(anyBound[1]) && dump.includes(service);
}

export async function verifyAccessibility(adb: Adb, client: ClientDef): Promise<boolean> {
  const dump = await shellText(adb, 'dumpsys accessibility').catch(() => '');
  return parseAccessibilityBound(dump, client.accessibilityService);
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
