// Mobile auth layer — used exclusively by the Capacitor iOS build.
// The web build (Vercel) continues to use NextAuth cookies through the normal
// /api/* proxy routes. This file is only active when window.Capacitor exists.

export const IS_NATIVE =
  typeof window !== 'undefined' && !!window?.Capacitor?.isNativePlatform?.();

const TOKEN_KEY  = 'valubull_jwt';
const API_BASE   = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ── Token storage (Capacitor Preferences = encrypted native storage) ──────────

export async function getStoredToken() {
  if (!IS_NATIVE) return null;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    return value || null;
  } catch {
    return null;
  }
}

export async function storeToken(token) {
  if (!IS_NATIVE) return;
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.set({ key: TOKEN_KEY, value: token });
}

export async function clearToken() {
  if (!IS_NATIVE) return;
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.remove({ key: TOKEN_KEY });
}

// ── Native sign-in — calls Railway Express directly, stores JWT ───────────────

export async function nativeSignIn(email, password) {
  const r    = await fetch(`${API_BASE}/api/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Login failed.');
  await storeToken(data.token);
  return data.user;
}

export async function nativeSignOut() {
  await clearToken();
}

// ── Authenticated fetch — routes to the right endpoint per platform ───────────
//
// On native: calls Railway backend directly using Bearer JWT.
//   authFetch('/api/watchlist', ...)   →  Railway /api/watchlist
//
// On web: calls the Next.js proxy route as normal.
//   authFetch('/api/watchlist', ...)   →  Next.js /api/watchlist proxy

export async function authFetch(path, opts = {}) {
  if (IS_NATIVE) {
    const token = await getStoredToken();
    return fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers || {}),
      },
    });
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
