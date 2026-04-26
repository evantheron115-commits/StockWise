import { useState, useEffect, useRef } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const PING_INTERVAL    = 4 * 60 * 1000; // 4 min — keeps Railway free tier awake
const WAKING_THRESHOLD = 2000;           // show "Connecting..." only if server takes > 2s
const FAIL_THRESHOLD   = 2;             // consecutive failures before showing "Offline"

// Returns: 'unknown' | 'up' | 'waking' | 'down'
export function useSentinel() {
  const [status, setStatus] = useState('unknown');
  const intervalRef    = useRef(null);
  const failStreak     = useRef(0);   // consecutive failure count

  useEffect(() => {
    if (typeof window === 'undefined') return;

    async function ping(showWakingIfSlow = false) {
      let wakeTimer = null;
      if (showWakingIfSlow) {
        wakeTimer = setTimeout(() => setStatus('waking'), WAKING_THRESHOLD);
      }
      try {
        const controller = new AbortController();
        // 30s covers Railway free-tier cold starts (can take 15–30s to wake)
        const hardTimeout = setTimeout(() => controller.abort(), 30000);
        const res = await fetch(`${API_BASE}/health`, {
          method: 'HEAD',
          cache:  'no-store',
          signal: controller.signal,
        });
        clearTimeout(hardTimeout);
        if (wakeTimer) clearTimeout(wakeTimer);
        if (res.ok) {
          failStreak.current = 0;
          setStatus('up');
        } else {
          failStreak.current += 1;
          setStatus(failStreak.current >= FAIL_THRESHOLD ? 'down' : 'waking');
        }
      } catch {
        if (wakeTimer) clearTimeout(wakeTimer);
        failStreak.current += 1;
        // Single timeout/error = 'waking' (Railway cold start); repeated = 'down'
        setStatus(failStreak.current >= FAIL_THRESHOLD ? 'down' : 'waking');
      }
    }

    // Re-ping immediately when the user returns to the tab
    function onVisibility() {
      if (document.visibilityState === 'visible') ping(true);
    }

    ping(true);
    intervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') ping(false);
    }, PING_INTERVAL);

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return status;
}
