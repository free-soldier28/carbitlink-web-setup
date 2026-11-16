import { useCallback, useEffect, useRef, useState } from 'react';
import type { Adb } from '@yume-chan/adb';
import {
  connect,
  getDevices,
  readDeviceInfo,
  requestDevice,
  webUsbSupported,
  type DeviceInfo,
} from './adb/connection';
import { installApk } from './adb/install';
import {
  addToBatteryWhitelist,
  enableAccessibility,
  enableNotificationListener,
  grantAppops,
  grantRuntimePermissions,
  launchApp,
  verifyAccessibility,
} from './adb/grants';
import { detectClient, type ClientDef } from './clients';
import { detectLang, saveLang, STRINGS, type Lang } from './i18n';
import { detectTheme, saveTheme, type Theme } from './theme';
import './App.css';

// Technical log lines are English; all user-facing UI strings come from i18n.

type Phase = 'idle' | 'working' | 'done' | 'error';

interface StepState {
  status: 'pending' | 'running' | 'ok' | 'warn' | 'error';
  detail?: string;
}

export default function App() {
  const [lang, setLang] = useState<Lang>(detectLang);
  const t = STRINGS[lang];
  const [theme, setTheme] = useState<Theme>(detectTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.title = t.title;
    document.documentElement.lang = lang;
  }, [t.title, lang]);

  const [supported] = useState(webUsbSupported());
  const [adb, setAdb] = useState<Adb | null>(null);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [apk, setApk] = useState<File | null>(null);
  const [client, setClient] = useState<ClientDef | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [steps, setSteps] = useState<StepState[]>([]);
  const [upload, setUpload] = useState({ done: 0, total: 0 });
  const [log, setLog] = useState<string[]>([]);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Map common connection failures to a friendly localized hint;
  // unknown errors fall back to the raw message.
  const formatConnectError = useCallback((e: unknown): string => {
    const raw = String(e);
    if (/already in use|busy/i.test(raw)) return `${t.errDeviceBusy} [${raw}]`;
    return `${t.errConnect}: ${raw}`;
  }, [t]);

  const addLog = useCallback((line: string) => {
    setLog((prev) => [...prev, line]);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [log]);

  const pickDevice = useCallback(async () => {
    setConnectError(null);
    try {
      const usbDevice = (await requestDevice()) ?? (await getDevices())[0];
      if (!usbDevice) return;
      const instance = await connect(usbDevice);
      const info = await readDeviceInfo(instance);
      setAdb(instance);
      setDevice(info);
      addLog(`device connected: ${info.model} (Android ${info.androidVersion})`);
    } catch (e) {
      setConnectError(formatConnectError(e));
      addLog(`connect failed: ${e}`);
    }
  }, [addLog, formatConnectError]);

  const onApkChange = useCallback((file: File | null) => {
    setApk(file);
    if (!file) { setClient(null); return; }
    const detected = detectClient(file.name);
    setClient(detected);
    if (detected) {
      addLog(`apk selected: ${file.name} → ${detected.name} (${detected.pkg})`);
    } else {
      addLog(`apk selected: ${file.name} → unknown client`);
    }
  }, [addLog]);

  const updateStep = (index: number, patch: Partial<StepState>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const run = useCallback(async () => {
    if (!adb || !apk || !client) return;
    setPhase('working');
    setInstallError(null);
    setUpload({ done: 0, total: apk.size });
    setSteps(t.steps.map(() => ({ status: 'pending' as const })));

    const setStep = (i: number, status: StepState['status'], detail?: string) => {
      updateStep(i, { status, detail });
    };

    try {
      // 1. install
      setStep(0, 'running');
      let lastReport = 0;
      await installApk(adb, apk, (p) => {
        // upload progress is bytes streamed; throttle UI updates
        if (p.uploadedBytes - lastReport > 512 * 1024 || p.phase === 'commit') {
          lastReport = p.uploadedBytes;
          setUpload({ done: p.uploadedBytes, total: p.totalBytes });
        }
      });
      setStep(0, 'ok');
      addLog('install: Success (attributed to com.android.vending)');

      // 2. runtime permissions
      setStep(1, 'running');
      const grants = await grantRuntimePermissions(adb, client);
      setStep(1, 'ok', t.detailPermissions(grants.permissionsGranted, grants.permissionsTotal));
      addLog(`permissions granted: ${grants.permissionsGranted}/${grants.permissionsTotal}`);

      // 3. appops
      setStep(2, 'running');
      await grantAppops(adb, client);
      setStep(2, 'ok');
      addLog('appops: usage stats / overlay / write settings / project media — allow');

      // 4. notification listener
      setStep(3, 'running');
      await enableNotificationListener(adb, client);
      setStep(3, 'ok');
      addLog('notification listener enabled');

      // 5. battery whitelist
      setStep(4, 'running');
      await addToBatteryWhitelist(adb, client);
      setStep(4, 'ok');
      addLog('battery whitelist: added');

      // 6. accessibility
      setStep(5, 'running');
      await enableAccessibility(adb, client);
      setStep(5, 'ok');
      addLog('accessibility service enabled');

      // 7. launch + verify
      setStep(6, 'running');
      await launchApp(adb, client);
      await new Promise((r) => setTimeout(r, 4000));
      const bound = await verifyAccessibility(adb, client);
      if (bound) {
        setStep(6, 'ok', t.detailTouchBackOk);
        addLog('accessibility bound (touch-back ready)');
      } else {
        setStep(6, 'warn', t.detailTouchBackWarn);
        addLog('accessibility NOT bound — enable it manually on the phone');
      }

      setPhase('done');
    } catch (e) {
      const stepIndex = steps.findIndex((s) => s.status === 'running');
      if (stepIndex >= 0) setStep(stepIndex, 'error', String(e));
      setInstallError(String(e));
      setPhase('error');
      addLog(`error: ${e}`);
    }
  }, [adb, apk, client, addLog, steps, t]);

  const pct = upload.total > 0 ? Math.round((upload.done / upload.total) * 100) : 0;

  return (
    <div className="container">
      <header>
        <div className="header-row">
          <div className="kicker">CARBITLINK · YILIAN</div>
          <div className="lang-switch">
            <div className="theme-switch">
              {(['light', 'dark'] as Theme[]).map((th) => (
                <button key={th}
                  className={th === theme ? 'theme active' : 'theme'}
                  title={t.toggleTheme}
                  onClick={() => { setTheme(th); saveTheme(th); }}>
                  {th === 'light' ? '☀' : '🌙'}
                </button>
              ))}
            </div>
            {(['ru', 'en'] as Lang[]).map((l) => (
              <button key={l}
                className={l === lang ? 'lang active' : 'lang'}
                onClick={() => { setLang(l); saveLang(l); }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <h1>{t.h1}</h1>
        <p className="lead">{t.lead}</p>
      </header>

      {!supported && <div className="banner banner-error">{t.bannerUnsupported}</div>}

      <section className="card">
        <h2>{t.stepPhone}</h2>
        {device ? (
          <div className="device">
            <span className="ok">✔</span> {device.model} · {t.android} {device.androidVersion}
          </div>
        ) : (
          <div>
            <button onClick={pickDevice} disabled={!supported}>
              {t.buttonConnect}
            </button>
            <p className="hint">{t.hintConnect}</p>
            {connectError && (
              <div className="banner banner-error">{connectError}</div>
            )}
          </div>
        )}
      </section>

      <section className="card">
        <h2>{t.stepApk}</h2>
        <input
          type="file"
          accept=".apk"
          onChange={(e) => onApkChange(e.target.files?.[0] ?? null)}
        />
        {apk && (
          <p className="hint">
            {apk.name} · {(apk.size / 1024 / 1024).toFixed(1)} {t.mb}{' '}
            {client
              ? <span className="ok">{t.recognizedAs} {client.name}</span>
              : <span className="warn">{t.notRecognized}</span>}
          </p>
        )}
      </section>

      <section className="card">
        <h2>{t.stepInstall}</h2>
        <button
          className="primary"
          disabled={!adb || !apk || !client || phase === 'working'}
          onClick={run}
        >
          {t.buttonInstall}
        </button>

        {phase === 'working' && upload.total > 0 && (
          <div className="progress">
            <div className="bar"><div style={{ width: `${pct}%` }} /></div>
            <span>{pct}%</span>
          </div>
        )}

        {steps.length > 0 && (
          <ul className="steps">
            {steps.map((s, i) => (
              <li key={i} className={s.status}>
                <span className="mark">
                  {s.status === 'ok' && '✔'}
                  {s.status === 'warn' && '!'}
                  {s.status === 'error' && '✖'}
                  {s.status === 'running' && '…'}
                  {s.status === 'pending' && '·'}
                </span>
                {t.steps[i]}
                {s.detail && <span className="detail"> — {s.detail}</span>}
              </li>
            ))}
          </ul>
        )}

        {phase === 'done' && <div className="banner banner-ok">{t.bannerDone}</div>}
        {installError && <div className="banner banner-error">{installError}</div>}
      </section>

      <details className="log">
        <summary>{t.logSummary}</summary>
        <div ref={logRef}>
          {log.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      </details>
    </div>
  );
}
