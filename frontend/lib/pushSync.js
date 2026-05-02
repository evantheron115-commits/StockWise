// Self-healing push token sync — called on every app launch from SplashGuard.
// Checks existing permission status; if granted, re-registers and posts the
// current device token to the backend. Idempotent: the backend upserts on
// (user_id, device_token) so duplicate calls are safe.

import { IS_NATIVE, authFetch } from './mobileAuth';
import { storageGet, storageSet } from './storageProvider';

const PUSH_TOKEN_KEY = 'valubull_push_token';

let _listening = false; // guard against duplicate addListener calls per session

export async function syncPushToken() {
  if (!IS_NATIVE) return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const { receive } = await PushNotifications.checkPermissions();
    if (receive !== 'granted') return;

    if (!_listening) {
      _listening = true;
      PushNotifications.addListener('registration', async (token) => {
        try {
          const cached = await storageGet(PUSH_TOKEN_KEY);
          if (cached === token.value) return; // already synced this token

          const r = await authFetch('/api/push/register', {
            method:  'POST',
            body:    JSON.stringify({ deviceToken: token.value, platform: 'ios' }),
          });
          if (r.ok) await storageSet(PUSH_TOKEN_KEY, token.value);
        } catch {}
      });
    }

    await PushNotifications.register();
  } catch {}
}
