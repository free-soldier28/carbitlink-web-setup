// Streaming APK install via `pm install-create/write/commit`.
// Installer attribution `com.android.vending` (Play Store) is critical for
// Android 13+/XOS: sideloaded installs get the "untrusted app" flag and the
// system blocks/reverts special access grants (see install.ps1).

import type { Adb } from '@yume-chan/adb';
import { shell, shellText, spawnStream } from './connection';

export interface InstallProgress {
  phase: 'create' | 'upload' | 'commit';
  uploadedBytes: number;
  totalBytes: number;
}

// Install an APK File with Play Store attribution, reporting upload progress.
export async function installApk(
  adb: Adb,
  apk: File,
  onProgress: (p: InstallProgress) => void,
): Promise<void> {
  onProgress({ phase: 'create', uploadedBytes: 0, totalBytes: apk.size });

  const createOut = await shellText(
    adb,
    'pm install-create -r -i com.android.vending',
  );
  const match = createOut.match(/Success:\s*\[(\d+)\]/);
  if (!match) {
    throw new Error(`install-create failed: ${createOut.trim()}`);
  }
  const sessionId = match[1];

  // `pm install-write -S <size> <session> base -` reads the APK from stdin.
  const write = await spawnStream(
    adb,
    `pm install-write -S ${apk.size} ${sessionId} base -`,
  );
  const stdin = write.stdin.getWriter();
  const reader = apk.stream().getReader();
  let uploaded = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      await stdin.write(value);
      uploaded += value.byteLength;
      onProgress({ phase: 'upload', uploadedBytes: uploaded, totalBytes: apk.size });
    }
  } finally {
    try { await reader.cancel(); } catch { /* already done */ }
    try { await stdin.close(); } catch { /* already closed */ }
  }
  // read stdout manually (type variance: Response() rejects the lib's stream type)
  let writeOut = '';
  const outReader = write.stdout.getReader();
  for (;;) {
    const { done, value } = await outReader.read();
    if (done) break;
    writeOut += new TextDecoder().decode(value);
  }
  await write.exited;
  if (!/Success/.test(writeOut)) {
    await abandonSession(adb, sessionId);
    throw new Error(`install-write failed: ${writeOut.trim()}`);
  }

  onProgress({ phase: 'commit', uploadedBytes: apk.size, totalBytes: apk.size });
  const commitOut = await shellText(adb, `pm install-commit ${sessionId}`);
  if (!/Success/.test(commitOut)) {
    throw new Error(`install-commit failed: ${commitOut.trim()}`);
  }
}

async function abandonSession(adb: Adb, sessionId: string): Promise<void> {
  try {
    await shell(adb, `pm install-abandon ${sessionId}`);
  } catch {
    // ignore
  }
}
