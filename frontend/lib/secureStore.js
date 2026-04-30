// Secure storage bridge — wraps @capacitor/preferences on native, localStorage on web.
//
// What this IS:
//   On iOS, @capacitor/preferences writes to NSUserDefaults inside the app's
//   sandboxed container. It is NOT accessible by other apps and is NOT synced
//   to iCloud (unlike web localStorage). This is a real security improvement
//   over web localStorage for a native build.
//
// What this is NOT:
//   This is not the iOS Keychain. The Secure Enclave protects biometric keys
//   only. True Keychain storage requires @capacitor-community/secure-storage
//   (not currently installed). For JWT tokens that's the correct long-term goal.
//
// Migration: on first native launch, any JWT found in localStorage is moved
// here and removed from localStorage so it no longer sits in the WebView's
// readable storage directory.

import { IS_NATIVE } from './mobileAuth';

const JWT_KEY = 'valubull_jwt';

async function getPreferences() {
  if (!IS_NATIVE) return null;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    return Preferences;
  } catch {
    return null;
  }
}

export async function secureGet(key) {
  const prefs = await getPreferences();
  if (prefs) {
    const { value } = await prefs.get({ key });
    return value;
  }
  try { return localStorage.getItem(key); } catch { return null; }
}

export async function secureSet(key, value) {
  const prefs = await getPreferences();
  if (prefs) {
    await prefs.set({ key, value: String(value) });
    return;
  }
  try { localStorage.setItem(key, value); } catch {}
}

export async function secureRemove(key) {
  const prefs = await getPreferences();
  if (prefs) {
    await prefs.remove({ key });
    return;
  }
  try { localStorage.removeItem(key); } catch {}
}

// JWT helpers — the most sensitive value in the app
export const getJWT    = ()        => secureGet(JWT_KEY);
export const setJWT    = (token)   => secureSet(JWT_KEY, token);
export const removeJWT = ()        => secureRemove(JWT_KEY);

// Run once on app start (called from _app.js SplashGuard or similar).
// Migrates any JWT that was stored in localStorage before this change.
export async function migrateLocalStorageJWT() {
  if (!IS_NATIVE) return;
  try {
    const legacy = localStorage.getItem(JWT_KEY);
    if (!legacy) return;
    await secureSet(JWT_KEY, legacy);
    localStorage.removeItem(JWT_KEY);
  } catch {}
}
