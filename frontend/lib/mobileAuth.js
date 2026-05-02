// Mobile auth layer — used exclusively by the Capacitor iOS build.
// The web build (Vercel) continues to use NextAuth cookies through the normal
// /api/* proxy routes. This file is only active when window.Capacitor exists.

import { storageGet, storageSet, storageRemove } from './storageProvider';

export const IS_NATIVE =
  typeof window !== 'undefined' && !!window?.Capacitor?.isNativePlatform?.();

const TOKEN_KEY         = 'valubull_jwt';
const REFRESH_TOKEN_KEY = 'valubull_refresh_token';
const API_BASE          = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ── Token storage — routed through storageProvider ────────────────────────────

export async function getStoredToken() {
  if (!IS_NATIVE) return null;
  return storageGet(TOKEN_KEY);
}

export async function storeToken(token) {
  if (!IS_NATIVE) return;
  await storageSet(TOKEN_KEY, token);
}

export async function clearToken() {
  if (!IS_NATIVE) return;
  await storageRemove(TOKEN_KEY);
  await storageRemove(REFRESH_TOKEN_KEY);
}

// ── Native sign-in — calls Railway Express directly, stores both tokens ───────

export async function nativeSignIn(email, password) {
  const r    = await fetch(`${API_BASE}/api/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Login failed.');
  await storageSet(TOKEN_KEY, data.token);
  if (data.refreshToken) await storageSet(REFRESH_TOKEN_KEY, data.refreshToken);
  return data.user;
}

export async function nativeSignOut() {
  await clearToken();
}

// ── Silent refresh ────────────────────────────────────────────────────────────
// Serialized: if two concurrent requests both hit 401, only one refresh fires.
// Returns true if a new access token was stored, false if refresh itself failed
// (in which case the user must sign in again).

let _refreshPromise = null;

async function _silentRefresh() {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      const refreshToken = await storageGet(REFRESH_TOKEN_KEY);
      if (!refreshToken) return false;

      const r = await fetch(`${API_BASE}/api/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken }),
      });

      if (!r.ok) {
        await storageRemove(REFRESH_TOKEN_KEY);
        return false;
      }

      const { token } = await r.json();
      await storageSet(TOKEN_KEY, token);
      return true;
    } catch {
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}

// ── Authenticated fetch — routes to the right endpoint per platform ───────────
//
// On native: injects Bearer JWT into every Railway request. On 401, attempts
// one silent refresh before giving up and firing 'valubull:auth-expired' so the
// app can redirect to the login screen.
//
// On web: delegates to Next.js proxy (NextAuth session cookie handles auth).

export async function authFetch(path, opts = {}, _isRetry = false) {
  if (IS_NATIVE) {
    const token = await getStoredToken();
    const res   = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers || {}),
      },
    });

    if (res.status === 401 && !_isRetry) {
      const refreshed = await _silentRefresh();
      if (refreshed) return authFetch(path, opts, true);
      // Refresh failed — tokens are dead; signal the app to force sign-out
      await clearToken();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('valubull:auth-expired'));
      }
    }

    return res;
  }
  // Web: call Next.js proxy (NextAuth session cookie handles auth)
  return fetch(path, opts);
}

// ── Biometric lock — wraps FaceID/TouchID around app entry ───────────────────

export async function requestBiometricAuth() {
  if (!IS_NATIVE) return true; // always pass on web
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    await BiometricAuth.authenticate({
      reason:       'Confirm your identity to access ValuBull',
      cancelTitle:  'Use Passcode',
      iosFallbackTitle: 'Use Device Passcode',
    });
    return true;
  } catch {
    return false; // User cancelled or biometrics unavailable — fall back gracefully
  }
}

// ── Haptic feedback ───────────────────────────────────────────────────────────

export async function hapticLight() {
  if (!IS_NATIVE) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {}
}

export async function hapticMedium() {
  if (!IS_NATIVE) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {}
}

export async function hapticSuccess() {
  if (!IS_NATIVE) return;
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Success });
  } catch {}
}

// ── Native share sheet ────────────────────────────────────────────────────────

export async function shareReport({ title, text, url }) {
  if (!IS_NATIVE) {
    // Web fallback — use the Web Share API if available
    if (navigator?.share) {
      await navigator.share({ title, text, url });
    }
    return;
  }
  try {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title, text, url, dialogTitle: 'Share Analysis' });
  } catch {}
}
