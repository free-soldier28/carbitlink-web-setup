// Client definitions ported from install.ps1 (carbitlink-setup repo).

export interface ClientDef {
  id: 'carbitlink' | 'yilian';
  name: string;
  pkg: string;
  accessibilityService: string;
  notificationListener: string;
}

export const CLIENTS: Record<ClientDef['id'], ClientDef> = {
  carbitlink: {
    id: 'carbitlink',
    name: 'CarBitLink (wws)',
    pkg: 'net.easyconn.carman.wws',
    accessibilityService: 'net.easyconn.carman.wws/net.easyconn.carman.accessibility.AccessibilityResultService',
    notificationListener: 'net.easyconn.carman.wws/net.easyconn.carman.NotificationService',
  },
  yilian: {
    id: 'yilian',
    name: 'Yilian / Driving Assistant',
    pkg: 'net.easyconn.carman',
    accessibilityService: 'net.easyconn.carman/net.easyconn.carman.common.SendService',
    notificationListener: 'net.easyconn.carman/net.easyconn.carman.NotificationService',
  },
};

// Runtime permissions — the same list for both clients; ones missing on a
// given Android version fail silently (same as install.ps1).
export const RUNTIME_PERMISSIONS = [
  'android.permission.RECORD_AUDIO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.BLUETOOTH_CONNECT',
  'android.permission.BLUETOOTH_SCAN',
  'android.permission.NEARBY_WIFI_DEVICES',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.READ_CONTACTS',
  'android.permission.READ_PHONE_STATE',
  'android.permission.CALL_PHONE',
];

// Detect the client from the APK filename; null when unknown.
export function detectClient(fileName: string): ClientDef | null {
  const lower = fileName.toLowerCase();
  if (lower.includes('carbitlink')) return CLIENTS.carbitlink;
  if (lower.includes('yilian')) return CLIENTS.yilian;
  return null;
}
