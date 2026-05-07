// Self-healing push token sync — called on every app launch from SplashGuard.
// Checks existing permission status; if granted, fetches the current FCM token
// and posts it to the backend. Idempotent: the backend upserts on
// (user_id, device_token) so duplicate calls are safe.

import { IS_NATIVE, authFetch } from './mobileAuth';
import { storageGet, storageSet } from './storageProvider';

const PUSH_TOKEN_KEY = 'valubull_push_token';

export async function syncPushToken() {
  if (!IS_NATIVE) return;
  try {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    const { receive } = await FirebaseMessaging.checkPermissions();
    if (receive !== 'granted') return;

    const { token } = await FirebaseMessaging.getToken();
    if (!token) return;

    const cached = await storageGet(PUSH_TOKEN_KEY);
    if (cached === token) return;

    const r = await authFetch('/api/push/register', {
      method: 'POST',
      body:   JSON.stringify({ deviceToken: token, platform: 'ios' }),
    });
    if (r.ok) await storageSet(PUSH_TOKEN_KEY, token);
  } catch {}
}
