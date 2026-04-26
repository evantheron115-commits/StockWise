import { useSentinel } from '../lib/sentinel';

// Renders a subtle connection status pill in the nav.
// Invisible when connected — only draws attention during cold-start or outage.
export default function StatusSentinel() {
  const status = useSentinel();

  if (status === 'unknown' || status === 'up') {
    return (
      <div
        className="flex items-center gap-1.5"
        title={status === 'up' ? 'Markets connected' : ''}
        aria-hidden
      >
        {status === 'up' && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 opacity-70" />
        )}
      </div>
    );
  }

  if (status === 'waking') {
    return (
      <div className="flex items-center gap-1.5" title="Backend waking up…" aria-live="polite">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-[10px] text-amber-500/80 font-mono hidden sm:block tracking-wide">
          Waking the Sovereign Engine…
        </span>
      </div>
    );
  }

  // 'down' — server is slow/sleeping, not necessarily permanently unreachable
  return (
    <div className="flex items-center gap-1.5" title="Server is waking up…" aria-live="assertive">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
      <span className="text-[10px] text-amber-500/80 font-mono hidden sm:block tracking-wide">
        Reconnecting…
      </span>
    </div>
  );
}
