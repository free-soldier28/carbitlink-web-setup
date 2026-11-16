// WebUSB ADB connection via @yume-chan/adb (ya-webadb).
// Chromium-only: Firefox and Safari do not implement WebUSB.

import { Adb, AdbDaemonTransport, type AdbShellProtocolProcess } from '@yume-chan/adb';
import type { AdbDaemonWebUsbDevice } from '@yume-chan/adb-daemon-webusb';
import { AdbDaemonWebUsbDeviceManager } from '@yume-chan/adb-daemon-webusb';
import AdbWebCredentialStore from '@yume-chan/adb-credential-web';

export interface DeviceInfo {
  serial: string;
  model: string;
  androidVersion: string;
}

const MANAGER_KEY = Symbol.for('carbitlink-web-setup.device-manager');

function getManager(): AdbDaemonWebUsbDeviceManager {
  const anyNav = navigator as unknown as Record<symbol, AdbDaemonWebUsbDeviceManager>;
  if (!anyNav[MANAGER_KEY]) {
    anyNav[MANAGER_KEY] = new AdbDaemonWebUsbDeviceManager(navigator.usb);
  }
  return anyNav[MANAGER_KEY];
}

export function webUsbSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.usb;
}

// Ask the user to pick a USB device (browser device picker); null on cancel.
export async function requestDevice(): Promise<AdbDaemonWebUsbDevice | null> {
  return (await getManager().requestDevice()) ?? null;
}

// Devices the user already granted access to.
export async function getDevices(): Promise<AdbDaemonWebUsbDevice[]> {
  return getManager().getDevices();
}

// Connect ADB to a WebUSB device and return a ready Adb instance.
export async function connect(device: AdbDaemonWebUsbDevice): Promise<Adb> {
  const connection = await device.connect();
  const transport = await AdbDaemonTransport.authenticate({
    serial: device.serial ?? '',
    connection,
    credentialStore: new AdbWebCredentialStore('Carbitlink Web Setup'),
  });
  return new Adb(transport);
}

// Read a few device properties for the UI.
export async function readDeviceInfo(adb: Adb): Promise<DeviceInfo> {
  const [model, androidVersion] = await Promise.all([
    shellText(adb, 'getprop ro.product.model'),
    shellText(adb, 'getprop ro.build.version.release'),
  ]);
  return {
    serial: adb.serial,
    model: model.trim() || 'unknown',
    androidVersion: androidVersion.trim() || 'unknown',
  };
}

// Run a shell command, return stdout text and the exit code.
// Requires the modern shell protocol (Android 5+ — always true today).
export interface ShellResult {
  stdout: string;
  exitCode: number;
}

export async function shell(adb: Adb, command: string): Promise<ShellResult> {
  const service = adb.subprocess.shellProtocol;
  if (!service) throw new Error('shell protocol is not supported by this device');
  const result = await service.spawnWaitText(command);
  return { stdout: result.stdout, exitCode: result.exitCode };
}

// Run a shell command and return its stdout as text.
export async function shellText(adb: Adb, command: string): Promise<string> {
  return (await shell(adb, command)).stdout;
}

// Run a shell command, ignore its output and errors (best-effort steps).
export async function shellBestEffort(adb: Adb, command: string): Promise<void> {
  try {
    await shell(adb, command);
  } catch {
    // ignore — same as install.ps1 Out-Null semantics
  }
}

// Spawn a process with a writable stdin (for streaming uploads).
export type StreamProcess = AdbShellProtocolProcess;

export async function spawnStream(
  adb: Adb,
  command: string,
): Promise<StreamProcess> {
  const service = adb.subprocess.shellProtocol;
  if (!service) throw new Error('shell protocol is not supported by this device');
  return service.spawn(command);
}
