import { useState, useEffect } from 'react';
import { useSession }          from 'next-auth/react';
import { useRouter }           from 'next/router';
import { hapticSuccess, hapticLight } from '../lib/haptics';

export default function WatchlistButton({ ticker }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [inWatchlist, setInWatchlist] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [checked,     setChecked]     = useState(false);

  // Check current status whenever ticker or session changes
  useEffect(() => {
    if (!session || !ticker) { setChecked(true); return; }
    setChecked(false);
    fetch(`/api/watchlist/${ticker}`)
      .then((r) => r.json())
      .then((data) => { setInWatchlist(!!data.inWatchlist); setChecked(true); })
      .catch(() => setChecked(true));
  }, [ticker, session]);

  async function toggle() {
    if (!session) {
      router.push('/auth/login');
      return;
    }

    setLoading(true);
    try {
      if (inWatchlist) {
        const r = await fetch(`/api/watchlist/${ticker}`, { method: 'DELETE' });
        if (r.ok) { setInWatchlist(false); hapticLight(); }
      } else {
        const r = await fetch('/api/watchlist', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ ticker }),
        });
        if (r.ok) { setInWatchlist(true); hapticSuccess(); }
      }
    } catch {}
    setLoading(false);
  }

  // Don't render until we know the state (prevents flicker)
  if (!checked) return null;

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={session
        ? inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'
        : 'Sign in to save to watchlist'}
      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
        inWatchlist
          ? 'bg-brand-600/20 border-brand-500/40 text-brand-400 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-400'
          : 'bg-surface-800 border-white/10 text-gray-500 hover:border-brand-500/40 hover:text-brand-400'
      }`}
    >
      <HeartIcon filled={inWatchlist} />
      {inWatchlist ? 'Watchlisted' : 'Add to Watchlist'}
    </button>
  );
}

function HeartIcon({ filled }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth={filled ? 0 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}
