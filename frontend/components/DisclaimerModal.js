import { useState, useEffect } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'valubull_disclaimer_ack';

export default function DisclaimerModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const ack = localStorage.getItem(STORAGE_KEY);
      if (!ack) setVisible(true);
    } catch {
      // localStorage unavailable (private browsing, etc.) — show modal anyway
      setVisible(true);
    }
  }, []);

  function handleAccept() {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch { /* ignore */ }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
      aria-describedby="disclaimer-body"
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
    >
      {/* Blocking backdrop — pointer-events-none on children would bypass this */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div className="relative w-full max-w-md bg-surface-900 border border-white/[0.10] rounded-2xl shadow-2xl p-6 sm:p-8">

        {/* Icon */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <h2 id="disclaimer-title" className="text-base font-semibold text-white">
              Important Disclaimer
            </h2>
            <p className="text-xs text-gray-500">Please read before continuing</p>
          </div>
        </div>

        {/* Body */}
        <div id="disclaimer-body" className="space-y-3 mb-6">
          <p className="text-sm text-gray-300 leading-relaxed">
            ValuBull provides financial data, analysis tools, and DCF models for
            <strong className="text-white"> informational and educational purposes only</strong>.
          </p>
          <p className="text-sm text-gray-400 leading-relaxed">
            Nothing on this platform constitutes financial advice, investment advice,
            trading advice, or any other form of advice. Past performance is not
            indicative of future results.
          </p>
          <p className="text-sm text-gray-400 leading-relaxed">
            You should always conduct your own research and consult a qualified
            financial professional before making any investment decision. ValuBull
            accepts no liability for investment or trading losses.
          </p>
          <p className="text-xs text-gray-600">
            By continuing, you confirm you have read and agree to our{' '}
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-400 hover:text-brand-300 underline underline-offset-2"
            >
              Terms of Use
            </Link>
            .
          </p>
        </div>

        {/* Action */}
        <button
          onClick={handleAccept}
          className="w-full btn-primary py-2.5 text-sm font-medium"
          autoFocus
        >
          I Understand — Continue to ValuBull
        </button>
      </div>
    </div>
  );
}
