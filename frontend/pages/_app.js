import '../styles/globals.css';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Component, useState, useRef, useEffect } from 'react';
import { SessionProvider, useSession, signOut } from 'next-auth/react';

class ErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <p className="text-red-400 text-sm mb-4">Something went wrong rendering this page.</p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.history.back(); }}
            className="btn-primary inline-block"
          >
            ← Go Back
          </button>
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
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
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
  const router = useRouter();
  const isHome = router.pathname === '/';

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
  return (
    <SessionProvider session={session}>
      <Head>
        <title>ValuBull — Intelligent Equity Analysis</title>
        <meta name="description" content="Professional stock analysis, DCF valuation, and financial statements." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen flex flex-col bg-surface-950">
        <Nav />
        <main className="flex-1">
          <ErrorBoundary>
            <Component {...pageProps} />
          </ErrorBoundary>
        </main>
        <footer className="border-t border-white/[0.06] py-5 text-center text-xs text-gray-700">
          ValuBull · Data from Financial Modeling Prep & Polygon.io · Not financial advice
        </footer>
      </div>
    </SessionProvider>
  );
}
