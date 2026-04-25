import { useState, useEffect, useCallback, useRef } from 'react';
import { IS_NATIVE } from '../lib/mobileAuth';
import { pingHealth } from '../lib/api';

// ConnectionGate is transparent on web — the browser and page-level error states
// handle connectivity there. On native (Capacitor iOS) it intercepts:
//   • Airplane mode  → immediate, synchronous detection via navigator.onLine
//   • Railway down   → detected via /health ping with 5s timeout
//
// It renders an overlay rather than replacing the tree, so the app underneath
// can resume instantly when connectivity is restored (no remount cost).

export default function ConnectionGate({ children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'ok' | 'offline' | 'unreachable'
  const retrying = useRef(false);

  const check = useCallback(async () => {
    if (!IS_NATIVE) { setStatus('ok'); return; }

    // Synchronous check — instant, no network request needed
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setStatus('offline');
      return;
    }

    // Async check — catches Railway being down even when phone has internet
    const reachable = await pingHealth();
    setStatus(reachable ? 'ok' : 'unreachable');
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  // Auto-recover when the OS fires the 'online' event (e.g. user turns off airplane mode)
  useEffect(() => {
    if (!IS_NATIVE) return;
    function handleOnline()  { retrying.current = false; check(); }
    function handleOffline() { setStatus('offline'); }
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [check]);

  async function handleRetry() {
    if (retrying.current) return;
    retrying.current = true;
    setStatus('checking');
    await check();
    retrying.current = false;
  }

  return (
    <>
      {children}
      {(status === 'offline' || status === 'unreachable' || status === 'checking') && IS_NATIVE && (
        <Overlay status={status} onRetry={handleRetry} />
      )}
    </>
  );
}

function Overlay({ status, onRetry }) {
  const isChecking = status === 'checking';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-6"
      style={{ backgroundColor: 'rgba(3, 7, 18, 0.97)' }} // surface-950 at near-full opacity
    >
      <div className="w-full max-w-xs text-center space-y-6">

        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-800 border border-white/[0.08] flex items-center justify-center">
            {isChecking ? <SpinnerIcon /> : status === 'offline' ? <WifiOffIcon /> : <ServerOffIcon />}
          </div>
        </div>

        {/* Copy */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-white">
            {isChecking
              ? 'Connecting…'
              : status === 'offline'
              ? 'No Internet Connection'
              : 'Service Unavailable'}
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            {isChecking
              ? 'Checking connection to ValuBull servers.'
              : status === 'offline'
              ? 'Turn off Airplane Mode or connect to Wi-Fi and tap Retry.'
              : 'ValuBull servers are temporarily unreachable. This is usually resolved within a minute.'}
          </p>
        </div>

        {/* Retry button — hidden while actively checking */}
        {!isChecking && (
          <button
            onClick={onRetry}
            className="w-full bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white font-medium text-sm py-3 rounded-xl transition-colors"
          >
            Retry
          </button>
        )}

        {/* Data disclaimer — always visible so reviewer sees it even on offline screen */}
        <p className="text-[11px] text-gray-700 leading-relaxed">
          ValuBull provides financial data for educational purposes only.
          Not investment advice.
        </p>
      </div>
    </div>
  );
}

function WifiOffIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="#6b7280" stroke="none" />
    </svg>
  );
}

function ServerOffIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="28" height="28" viewBox="0 0 24 24" fill="none"
      stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"
      className="animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
