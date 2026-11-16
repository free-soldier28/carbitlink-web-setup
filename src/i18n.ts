// UI strings: Russian and English. Language is auto-selected from the browser
// locale (ru* → Russian, anything else → English); user can override.

export type Lang = 'ru' | 'en';

const STORAGE_KEY = 'carbitlink-web-setup.lang';

// Manual override persists across visits; otherwise fall back to the
// browser's preferred languages list (first entry wins).
export function detectLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'ru' || saved === 'en') return saved;
  if (typeof navigator === 'undefined') return 'en';
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const l of langs) {
    if (l?.toLowerCase().startsWith('ru')) return 'ru';
    if (l?.toLowerCase().startsWith('en')) return 'en';
  }
  return 'en';
}

export function saveLang(lang: Lang): void {
  localStorage.setItem(STORAGE_KEY, lang);
}

const RU = {
  title: 'Carbitlink/Yilian Web Setup',
  h1: 'Установка с компьютера',
  lead: 'Подключите телефон кабелем, включите «Отладку по USB», выберите APK — ' +
        'программа сама установит его и выдаст все права.',
  bannerUnsupported: 'Ваш браузер не поддерживает WebUSB. Откройте страницу в Chrome или Edge на компьютере.',
  stepPhone: '1 · Телефон',
  buttonConnect: 'Подключить телефон',
  hintConnect: 'На телефоне: Настройки → Для разработчиков → Отладка по USB. Затем подтвердите запрос «Разрешить отладку по USB?».',
  android: 'Android',
  stepApk: '2 · APK-файл',
  recognizedAs: '— распознан:',
  notRecognized: '— не удалось распознать (carbitlink / yilian)',
  stepInstall: '3 · Установка',
  buttonInstall: 'Установить и настроить',
  bannerDone: 'Готово! Подключите телефон к магнитоле. Повторный запуск безопасен.',
  logSummary: 'Технический лог',
  steps: [
    'Установка APK (атрибуция Play Store)',
    'Разрешения (микрофон, гео, уведомления...)',
    'Спец-доступы (appops)',
    'Доступ к уведомлениям',
    'Белый список батареи',
    'Accessibility (управление с магнитолы)',
    'Запуск приложения',
  ],
  detailTouchBackOk: 'touch-back готов',
  detailTouchBackWarn: 'включите сервис вручную: Настройки → Спец. возможности',
  detailPermissions: (granted: number, total: number) => `${granted}/${total}`,
};

type Dict = typeof RU;

const EN: Dict = {
  title: 'Carbitlink/Yilian Web Setup',
  h1: 'Install from your computer',
  lead: 'Connect the phone with a cable, enable "USB debugging", pick the APK — ' +
        'the app will install it and grant all permissions for you.',
  bannerUnsupported: 'Your browser does not support WebUSB. Open this page in Chrome or Edge on a computer.',
  stepPhone: '1 · Phone',
  buttonConnect: 'Connect phone',
  hintConnect: 'On the phone: Settings → Developer options → USB debugging. Then confirm the "Allow USB debugging?" prompt.',
  android: 'Android',
  stepApk: '2 · APK file',
  recognizedAs: '— recognized:',
  notRecognized: '— unrecognized (carbitlink / yilian)',
  stepInstall: '3 · Install',
  buttonInstall: 'Install and configure',
  bannerDone: 'Done! Connect the phone to the head unit. Re-running is safe.',
  logSummary: 'Technical log',
  steps: [
    'Install APK (Play Store attribution)',
    'Permissions (microphone, location, notifications...)',
    'Special access (appops)',
    'Notification access',
    'Battery whitelist',
    'Accessibility (head unit control)',
    'Launch the app',
  ],
  detailTouchBackOk: 'touch-back ready',
  detailTouchBackWarn: 'enable the service manually: Settings → Accessibility',
  detailPermissions: (granted: number, total: number) => `${granted}/${total}`,
};

export const STRINGS: Record<Lang, Dict> = { ru: RU, en: EN };
