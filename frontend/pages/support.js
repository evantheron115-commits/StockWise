import Head from 'next/head';
import Link from 'next/link';

const APP_NAME = 'ValuBull';
const CONTACT  = 'evantheron115@gmail.com';

const faqs = [
  {
    q: 'Why is stock data not loading?',
    a: `Check your internet connection first. If you're on a VPN or restricted network, financial data feeds may be blocked. Try switching to a different network or disabling the VPN. If the issue persists, the data provider may be experiencing temporary delays — try again in a few minutes.`,
  },
  {
    q: 'The price I see doesn\'t match another app. Why?',
    a: `${APP_NAME} sources real-time and delayed market data from Financial Modeling Prep and Polygon.io. Minor discrepancies between data providers are normal due to different data feeds, exchange reporting times, and rounding conventions. For trading decisions, always verify against your brokerage's official feed.`,
  },
  {
    q: 'My watchlist disappeared after reinstalling.',
    a: `Watchlist data is linked to your account, not your device. Make sure you\'re signed in with the same account you used before. If you used Sign in with Apple and chose to hide your email, use the same Apple ID to restore access.`,
  },
  {
    q: 'How do I delete my account?',
    a: `Go to Settings → Account Settings → Delete My Account. All personal data (email, name, watchlist) is permanently removed within 30 days. Community posts are anonymised but retained as part of the public discussion record.`,
  },
  {
    q: 'What does the green pulse indicator mean?',
    a: `The bioluminescent pulse in the top-right of a stock page confirms you have an active WebSocket connection and are receiving live price data. If the indicator is absent or grey, the real-time connection is inactive — pull to refresh or navigate away and back to reconnect.`,
  },
  {
    q: 'The DCF valuation seems very different from the current stock price. Is that a bug?',
    a: `No — this is by design. A DCF model calculates intrinsic value based on the assumptions you input (growth rate, discount rate, terminal multiple). Divergence from the market price reflects the market\'s own assumptions, which may differ significantly from yours. The model is a research tool, not a price prediction system.`,
  },
  {
    q: 'Can I export financial data or DCF results?',
    a: `Not in the current version. The ability to export statements and DCF scenarios to CSV or PDF is on the roadmap for a future release.`,
  },
  {
    q: 'Why can\'t I find a specific company?',
    a: `${APP_NAME} covers publicly traded equities on major US exchanges (NYSE, NASDAQ, AMEX). OTC stocks, international-only listings, ETFs, mutual funds, and crypto are not currently supported. Search by company name or ticker symbol.`,
  },
  {
    q: 'Face ID / Touch ID isn\'t working.',
    a: `${APP_NAME} uses biometric authentication as an optional security layer for your account. If biometrics fail, you can always sign in with your email and password. Ensure Face ID / Touch ID is enabled for ${APP_NAME} in iOS Settings → Face ID & Passcode → Other Apps.`,
  },
  {
    q: 'How current is the financial statement data?',
    a: `Annual and quarterly financials are updated shortly after companies file with the SEC (10-K and 10-Q filings). Data typically appears within 24 hours of filing. The most recent fiscal period shown is displayed in the column header of each financial table.`,
  },
];

export default function Support() {
  return (
    <>
      <Head>
        <title>Support — {APP_NAME}</title>
        <meta name="description" content={`Get help with ${APP_NAME} — FAQs, troubleshooting, and contact information.`} />
      </Head>

      <div className="max-w-3xl mx-auto px-4 py-10 prose-legal">

        <div className="mb-8">
          <Link href="/" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            ← Back
          </Link>
          <h1 className="text-2xl font-semibold text-white mt-4 mb-1">{APP_NAME} Support</h1>
          <p className="text-xs text-gray-600">We typically respond within 1–2 business days.</p>
        </div>

        <Section title="Contact Us">
          <p>
            For any issue not covered below, email us directly at{' '}
            <a href={`mailto:${CONTACT}`} className="text-brand-400 hover:text-brand-300">
              {CONTACT}
            </a>
            . Please include your device model, iOS version, and a brief description of
            the issue. Screenshots are always helpful.
          </p>
        </Section>

        <Section title="Frequently Asked Questions">
          <div className="space-y-5 mt-1">
            {faqs.map(({ q, a }) => (
              <div key={q} className="border-b border-white/[0.05] pb-5 last:border-0 last:pb-0">
                <p className="text-sm font-medium text-gray-300 mb-1">{q}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Known Limitations">
          <ul>
            <li>Data coverage is limited to US-listed equities. International exchanges are not supported.</li>
            <li>Real-time WebSocket pricing requires a stable internet connection. Offline mode shows the last cached price.</li>
            <li>Free-tier data limits may occasionally cause brief delays during peak market hours.</li>
            <li>Community Chat messages are not end-to-end encrypted and should not contain sensitive personal or financial information.</li>
          </ul>
        </Section>

        <Section title="Data & Privacy">
          <p>
            {APP_NAME} does not sell your data or use it for advertising. Financial data
            is sourced from Financial Modeling Prep and Polygon.io under data licensing
            agreements. For full details, see our{' '}
            <Link href="/privacy" className="text-brand-400 hover:text-brand-300">
              Privacy Policy
            </Link>
            {' '}and{' '}
            <Link href="/terms" className="text-brand-400 hover:text-brand-300">
              Terms of Use
            </Link>
            .
          </p>
        </Section>

        <Section title="App Version">
          <p>
            Current release: <span className="text-gray-300 font-medium">1.0.0</span>.
            Updates are delivered automatically through the App Store. Ensure automatic
            updates are enabled in iOS Settings → App Store → App Updates.
          </p>
        </Section>

        <div className="mt-10 pt-6 border-t border-white/[0.06] flex items-center gap-4 text-xs text-gray-700">
          <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms of Use</Link>
          <span>·</span>
          <Link href="/" className="hover:text-gray-400 transition-colors">Home</Link>
        </div>

      </div>
    </>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-7">
      <h2 className="text-base font-semibold text-white mb-3">{title}</h2>
      <div className="text-sm text-gray-500 leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-brand-400 [&_a:hover]:text-brand-300 [&_strong]:text-gray-400">
        {children}
      </div>
    </section>
  );
}
