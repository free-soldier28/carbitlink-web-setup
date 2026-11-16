# Plan — Carbitlink/Yilian Web Setup (GitHub Pages, WebUSB ADB)

## Goal

A static web app hosted on GitHub Pages that replaces `setup.bat` for cable
users: connect phone → open page → pick client → the app installs the patched
APK and grants all permissions via ADB over WebUSB. Tech: React + TypeScript +
[@yume-chan/adb](https://github.com/yume-chan/ya-webadb) (option 1).

## Constraints (accepted)

- Chromium-only (Chrome/Edge/Opera on Windows/macOS/Linux). Firefox/Safari: no WebUSB.
- USB cable only — no `adb connect` Wi-Fi mode on the web.
- HTTPS is required for WebUSB — GitHub Pages provides it.
- APK is NOT stored in the repo. The page downloads it at runtime from a URL
  (GitHub Release asset of this repo, mirrored from the NAS) and streams it to
  the device with `install -i com.android.vending` attribution.
- User must still enable USB debugging and tap "Allow" on the phone.

## Stack

- Vite + React + TypeScript (minimal deps, fast static build).
- `@yume-chan/adb` + `@yume-chan/adb-daemon-webusb` + `@yume-chan/adb-server-node-tcp` (not used initially — cable only).
- No backend, no state. All logic client-side.

## Repository layout

```
carbitlink-web/
├── index.html
├── package.json / tsconfig / vite.config.ts
├── .github/workflows/deploy.yml      # build + deploy to Pages on push to master
├── public/
│   └── favicon / icons
└── src/
    ├── main.tsx / App.tsx
    ├── adb/
    │   ├── connect.ts                # WebUSB device request, AdbDaemonWebUsb transport
    │   ├── commands.ts               # shell/install wrappers (port of install.ps1 logic)
    │   └── progress.ts               # streaming install / sync progress events
    ├── clients/
    │   ├── carbitlink.ts             # package net.easyconn.carman.wws + permission set
    │   ├── yilian.ts                 # package net.easyconn.carman + permission set
    │   └── index.ts                  # APK filename → client detection
    ├── ui/
    │   ├── DevicePicker.tsx          # "Connect phone" button, state of the device
    │   ├── ClientChoice.tsx          # CarBitLink / Yilian cards
    │   ├── StepProgress.tsx          # step list: connect → install → grants → launch
    │   └── LogView.tsx               # collapsible technical log (English)
    └── i18n/                         # RU + EN UI strings (default RU)
```

## Ported logic (from install.ps1)

1. APK attribution install: `adb install -r -i com.android.vending <apk>` —
   via `AdbSync`h `install` with installer package id (critical for Android 13+/XOS
   "untrusted app" flag).
2. Runtime permissions per client (mic, contacts, phone, notifications, geo incl.
   background, BT, Wi-Fi neighbors, storage) — `pm grant`.
3. appops: `SYSTEM_ALERT_WINDOW`, `WRITE_SETTINGS`.
4. `cmd notification allow_listener <pkg/...>`.
5. Battery whitelist: `dumpsys deviceidle whitelist +<pkg>`.
6. Accessibility: `settings put secure enabled_accessibility_services ...` per client.
7. `am start` the app; verify `patched:` marker via `dumpsys package` versionName if feasible.
8. Existing-app conflict (different signature): offer uninstall (`pm uninstall`) → reinstall.
   Fresh-install guard: skip uninstall prompt when package absent.

Steps are idempotent — safe to re-run, mirroring install.ps1.

## APK source

- Release assets of this repo: `carbitlink-6.5.1-patched-v12.apk`,
  `yilian-13.3-patched-v14-signed.apk` (uploaded manually from NAS, same builds
  as the ZIP distribution).
- Page fetches the chosen APK with progress; CORS is satisfied on
  `objects.githubusercontent.com` (Release assets allow cross-origin GET).
- Fallback: "select APK file manually" `<input type=file>` — works for mirrors.

## Build & deploy

- `npm run build` → `dist/` → GitHub Actions `actions/deploy-pages`.
- Pages URL: `https://<user>.github.io/carbitlink-web/` (set `base` in vite.config).
- Lighthouse-friendly single page; no router needed.

## Milestones

1. **M1 — skeleton**: Vite app, WebUSB connect, live device state (model, serial,
   Android version). Deployed to Pages.
2. **M2 — install**: APK download (Release URL) + streaming attributed install
   with progress bar.
3. **M3 — grants**: full permission/appops/notification/battery/accessibility
   port from install.ps1, step-by-step progress UI, idempotent re-runs.
4. **M4 — polish**: RU/EN strings, conflict/uninstall flow, log view, error
   hints (unauthorized, no device, non-Chromium browser banner), link to PDF
   instruction.

## Out of scope (v1)

- Wi-Fi / TCP ADB.
- Firefox/Safari support.
- Auto-update of APKs (manual Release upload).

## Conventions

Per AGENTS.md of the parent project: all code, comments, logs in English;
user-facing UI strings RU/EN.
