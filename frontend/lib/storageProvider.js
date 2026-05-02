// Platform-aware storage provider — single source of truth for all key/value persistence.
// Resolves once at startup: @capacitor/preferences on native, localStorage on web.
// All callers use storageGet/Set/Remove; no code outside this file imports Preferences directly.

// Inline platform check — avoids a circular dep with mobileAuth.js.
const IS_NATIVE = typeof window !== 'undefined' && !!window?.Capacitor?.isNativePlatform?.();

let _provider = null;

async function resolve() {
  if (_provider) return _provider;

  if (IS_NATIVE) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      _provider = {
        get:    async (key)        => { const { value } = await Preferences.get({ key }); return value ?? null; },
        set:    async (key, value) => { await Preferences.set({ key, value: String(value) }); },
        remove: async (key)        => { await Preferences.remove({ key }); },
      };
      return _provider;
    } catch {}
  }

  _provider = {
    get:    async (key)        => { try { return localStorage.getItem(key); }        catch { return null; } },
    set:    async (key, value) => { try { localStorage.setItem(key, String(value)); } catch {} },
    remove: async (key)        => { try { localStorage.removeItem(key); }             catch {} },
  };
  return _provider;
}

export async function storageGet(key)        { return (await resolve()).get(key); }
export async function storageSet(key, value) { return (await resolve()).set(key, value); }
export async function storageRemove(key)     { return (await resolve()).remove(key); }
