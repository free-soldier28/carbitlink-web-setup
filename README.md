# Carbitlink/Yilian Web Setup

Web client that installs the patched CarBitLink / Yilian APK on an Android
phone from a PC — no `setup.bat`, no PowerShell. Runs entirely in the browser
on GitHub Pages and talks to the phone over ADB via WebUSB
([ya-webadb](https://github.com/yume-chan/ya-webadb)).

The user picks the APK file from disk; the page streams it to the device with
Play Store attribution (`pm install-create -i com.android.vending`) and grants
the full permission set (runtime permissions, appops, notification listener,
battery whitelist, accessibility service), then launches the app. Logic is a
port of `install.ps1` from the [carbitlink-setup](https://github.com/free-soldier28/carbitlink-setup) repo.

## Requirements

- Chromium browser (Chrome / Edge / Opera). Firefox and Safari do not support WebUSB.
- USB cable. Wi-Fi ADB is not possible over WebUSB.
- USB debugging enabled on the phone; user confirms the "Allow USB debugging?" prompt.

## Development

```sh
npm install
npm run dev      # http://localhost:5173/carbitlink-web-setup/
npm run build    # dist/
npm run preview
```

## Deployment

Push to `master` → GitHub Actions builds and deploys `dist/` to GitHub Pages
([.github/workflows/deploy.yml](.github/workflows/deploy.yml)). Enable
**Settings → Pages → Source: GitHub Actions** once after creating the repo.

## Layout

- `src/adb/connection.ts` — WebUSB device picker, ADB auth, shell helpers
- `src/adb/install.ts` — streaming attributed APK install (`pm install-create/write/commit`)
- `src/adb/grants.ts` — permission/appops/notification/battery/accessibility setup
- `src/clients.ts` — client definitions (packages, services) and APK filename detection
- `src/App.tsx` — UI (Russian user-facing strings)

## Conventions

All code, comments and logs are in English; user-facing UI strings are Russian
(see AGENTS.md in the carbitlink-setup repo).
