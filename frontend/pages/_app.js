import '../styles/globals.css';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Component, useState, useRef, useEffect } from 'react';
import { SessionProvider, useSession, signOut } from 'next-auth/react';
import { AnimatePresence, motion } from 'framer-motion';
import DisclaimerModal from '../components/DisclaimerModal';
import Onboarding from '../components/Onboarding';
import ConnectionGate from '../components/ConnectionGate';
import AuroraBackground from '../components/AuroraBackground';
import StatusSentinel from '../components/StatusSentinel';
import { IS_NATIVE } from '../lib/mobileAuth';

// Hides the Capacitor splash screen once React has mounted and the session
// state is known. Without this, a white WebView background flashes between
// the splash and first render on slower devices.
function SplashGuard() {
  const { status } = useSession();
  const dismissed = useRef(false);

  useEffect(() => {
    if (dismissed.current || status === 'loading') return;
    dismissed.current = true;
    if (!IS_NATIVE) return;
    import('@capacitor/splash-screen')
      .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 200 }))
      .catch(() => {});
  }, [status]);

  return null;
}

class ErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) {
    console.error('[ErrorBoundary]', err);
    // Silently redirect to home after a brief pause so the user sees the
    // recovery message rather than a jarring instant redirect.
    setTimeout(() => { window.location.href = '/'; }, 1500);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <p className="text-gray-600 text-xs font-mono animate-pulse">Recovering…</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!session) {
    return (
      <Link
        href="/auth/login"
        className="text-xs font-medium bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg transition-colors"
      >
        Sign In
      </Link>
    );
  }

  const initials = session.user?.name
    ? session.user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : session.user?.email?.[0]?.toUpperCase() || '?';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 group"
        aria-label="User menu"
      >
        {session.user?.avatar || session.user?.image ? (
          <img
            src={session.user.avatar || session.user.image}
            alt=""
            className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-xs font-semibold text-white">
            {initials}
          </div>
        )}
        <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors hidden sm:block max-w-[120px] truncate">
          {session.user?.name || session.user?.email}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-surface-900 border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <p className="text-xs font-medium text-gray-200 truncate">
              {session.user?.name || 'Account'}
            </p>
            <p className="text-[11px] text-gray-600 truncate">{session.user?.email}</p>
          </div>
          <Link
            href="/portfolio"
            onClick={() => setOpen(false)}
            className="block w-full text-left px-4 py-2.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-white/[0.04] transition-colors"
          >
            My Watchlist
          </Link>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block w-full text-left px-4 py-2.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-white/[0.04] transition-colors"
          >
            Settings
          </Link>
          <Link
            href="/privacy"
            onClick={() => setOpen(false)}
            className="block w-full text-left px-4 py-2.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-white/[0.04] transition-colors border-t border-white/[0.06]"
          >
            Privacy Policy
          </Link>
          <button
            onClick={() => {
              // Wipe all local snapshots and recent history so the next user
              // of this device starts clean (App Store privacy requirement).
              try {
                Object.keys(localStorage)
                  .filter(k => k.startsWith('valubull_'))
                  .forEach(k => localStorage.removeItem(k));
              } catch {}
              signOut({ callbackUrl: '/' });
            }}
            className="w-full text-left px-4 py-2.5 text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

function Nav() {
  const router  = useRouter();
  const isHome  = router.pathname === '/';
  const { data: session } = useSession();

  return (
    <nav className="border-b border-white/[0.06] bg-surface-900/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-13 flex items-center justify-between" style={{ height: '52px' }}>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center shadow-glow">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <polyline points="1,10 4,6 7,8 10,3 13,5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-white font-semibold text-base tracking-tight group-hover:text-brand-300 transition-colors">
            ValuBull
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {!isHome && (
            <Link
              href="/"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors hidden sm:block"
            >
              ← Search
            </Link>
          )}
          {session && (
            <Link
              href="/portfolio"
              className={`text-xs transition-colors hidden sm:block ${
                router.pathname === '/portfolio'
                  ? 'text-brand-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Watchlist
            </Link>
          )}
          <StatusSentinel />
          <span className="text-xs text-gray-700 hidden md:block">
            Not financial advice
          </span>
          <UserMenu />
        </div>

      </div>
    </nav>
  );
}

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  const router = useRouter();
  return (
    <SessionProvider session={session}>
      <SplashGuard />
      <ConnectionGate>
        <Head>
          <title>ValuBull — Intelligent Equity Analysis</title>
          <meta name="description" content="Professional stock analysis, DCF valuation, and financial statements." />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <div className="min-h-screen flex flex-col bg-surface-950" style={{ position: 'relative', zIndex: 1 }}>
          <AuroraBackground />
          <Nav />
          <main className="flex-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={router.pathname}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <ErrorBoundary>
                  <Component {...pageProps} />
                </ErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </main>

          <footer
            role="contentinfo"
            className="border-t border-white/[0.06] bg-surface-900/60 py-6 mt-4 print:hidden"
          >
            <div className="max-w-5xl mx-auto px-4 space-y-3 text-center">
              <p className="text-xs text-gray-500 leading-relaxed max-w-2xl mx-auto">
                <strong className="text-gray-400">Disclaimer:</strong> All information provided
                by ValuBull is for informational and educational purposes only and does not
                constitute financial advice, investment advice, or any other type of advice.
                Past performance is not indicative of future results. Consult a qualified
                financial professional before making any investment decision.
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-gray-700">
                <Link href="/terms" className="hover:text-gray-400 transition-colors">
                  Terms of Use
                </Link>
                <span aria-hidden="true">·</span>
                <span>Data: Financial Modeling Prep &amp; Polygon.io</span>
                <span aria-hidden="true">·</span>
                <span>© {new Date().getFullYear()} ValuBull</span>
              </div>
            </div>
          </footer>

          <DisclaimerModal />
          <Onboarding />
        </div>
      </ConnectionGate>
    </SessionProvider>
  );
}
