import '../styles/globals.css';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Component } from 'react';

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
        </div>

      </div>
    </nav>
  );
}

export default function App({ Component, pageProps }) {
  return (
    <>
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
    </>
  );
}
