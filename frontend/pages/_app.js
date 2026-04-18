import '../styles/globals.css';
import Head from 'next/head';
import Link from 'next/link';
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

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Stoxora — Intelligent Equity Analysis</title>
        <meta name="description" content="DCF valuation, financial statements, and stock analysis" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="min-h-screen flex flex-col">
        {/* Nav */}
        <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/" className="text-white font-semibold text-lg tracking-tight">
              Stoxora
            </Link>
            <span className="text-xs text-gray-600 hidden sm:block">
              For informational purposes only. Not financial advice.
            </span>
          </div>
        </nav>

        <main className="flex-1">
          <ErrorBoundary>
            <Component {...pageProps} />
          </ErrorBoundary>
        </main>

        <footer className="border-t border-gray-800 py-6 text-center text-xs text-gray-700">
          Stoxora · Data from Financial Modeling Prep & Polygon.io · Not financial advice
        </footer>
      </div>
    </>
  );
}
