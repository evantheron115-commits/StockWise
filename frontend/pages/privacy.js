import Head from 'next/head';
import Link from 'next/link';

const LAST_UPDATED = 'April 22, 2026';
const APP_NAME     = 'ValuBull';
const CONTACT      = 'evantheron115@gmail.com';

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy — {APP_NAME}</title>
        <meta name="description" content={`${APP_NAME} Privacy Policy`} />
      </Head>

      <div className="max-w-3xl mx-auto px-4 py-10 prose-legal">

        <div className="mb-8">
          <Link href="/" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            ← Back
          </Link>
          <h1 className="text-2xl font-semibold text-white mt-4 mb-1">{APP_NAME} Privacy Policy</h1>
          <p className="text-xs text-gray-600">Last updated: {LAST_UPDATED}</p>
        </div>

        <Section title="1. Overview">
          <p>
            {APP_NAME} ("we", "us", "our") is a financial data research tool. This Privacy Policy
            explains what information we collect, how we use it, and your rights. By using {APP_NAME},
            you agree to the practices described here. We do not provide financial advice and all data
            is for informational purposes only.
          </p>
        </Section>

        <Section title="2. Information We Collect">
          <h3>2.1 Account Information</h3>
          <p>
            When you create an account, we collect your email address and, optionally, your display
            name. If you sign in with Google or Apple, we receive your email address, name, and profile
            photo from that provider.
          </p>
          <h3>2.2 Usage Data</h3>
          <p>
            We collect information about how you use the app, including the stocks you view, watchlist
            additions, and features accessed. This data is used solely to improve the service.
          </p>
          <h3>2.3 Device Information</h3>
          <p>
            On our iOS app, we may collect device identifiers and operating system version for
            debugging and crash reporting. We do not use this data for advertising.
          </p>
          <h3>2.4 Financial Data</h3>
          <p>
            We do not collect or store any of your personal financial data, brokerage accounts,
            portfolio holdings, or payment information.
          </p>
        </Section>

        <Section title="3. How We Use Your Information">
          <ul>
            <li>To create and manage your account.</li>
            <li>To save and retrieve your watchlist.</li>
            <li>To allow you to participate in community discussion threads.</li>
            <li>To improve the app's features and fix bugs.</li>
            <li>To communicate service-related updates (not marketing without consent).</li>
          </ul>
          <p>We do not sell, rent, or trade your personal information to any third party.</p>
        </Section>

        <Section title="4. Financial Data Sources">
          <p>
            Market data, financial statements, and company profiles are sourced from
            Financial Modeling Prep (FMP) and Polygon.io under their respective data licensing
            agreements. All financial data displayed in {APP_NAME} is for informational and
            educational purposes only and does not constitute financial advice, investment
            recommendations, or an offer to buy or sell any security.
          </p>
        </Section>

        <Section title="5. Third-Party Services">
          <p>We use the following third-party services:</p>
          <ul>
            <li><strong>Google Sign-In</strong> (optional login) — subject to Google's Privacy Policy.</li>
            <li><strong>Sign in with Apple</strong> (optional login) — subject to Apple's Privacy Policy.</li>
            <li><strong>Vercel</strong> — frontend hosting. May log request metadata.</li>
            <li><strong>Railway</strong> — backend and database hosting. Data is encrypted at rest.</li>
          </ul>
        </Section>

        <Section title="6. Data Retention">
          <p>
            We retain your account data for as long as your account is active. You may delete your
            account at any time from Settings → Account Settings → Delete My Account. Upon deletion,
            all personal data (email, name, watchlist) is permanently removed within 30 days.
            Community posts are anonymised (username replaced with "Anonymous") but not deleted, as
            they form part of the public discussion record.
          </p>
        </Section>

        <Section title="7. Your Rights">
          <ul>
            <li><strong>Access:</strong> You may request a copy of data we hold about you.</li>
            <li><strong>Correction:</strong> You may correct inaccurate account information.</li>
            <li><strong>Deletion:</strong> You may delete your account at any time in-app.</li>
            <li><strong>Portability:</strong> You may request your data in a portable format.</li>
          </ul>
          <p>
            To exercise any right, contact us at <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
          </p>
        </Section>

        <Section title="8. Children's Privacy">
          <p>
            {APP_NAME} is not directed at children under 13. We do not knowingly collect personal
            information from children. If you believe a child has provided us information, contact
            us immediately and we will delete it.
          </p>
        </Section>

        <Section title="9. Security">
          <p>
            Passwords are stored as bcrypt hashes. Data is transmitted over HTTPS. Database
            connections are encrypted. However, no system is 100% secure and we cannot guarantee
            absolute security.
          </p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>
            We may update this Privacy Policy. Significant changes will be notified via the app.
            Continued use after changes constitutes acceptance.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            Questions about this policy? Email us at{' '}
            <a href={`mailto:${CONTACT}`} className="text-brand-400 hover:text-brand-300">
              {CONTACT}
            </a>.
          </p>
        </Section>

        <div className="mt-10 pt-6 border-t border-white/[0.06] flex items-center gap-4 text-xs text-gray-700">
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
      <div className="text-sm text-gray-500 leading-relaxed space-y-3 [&_h3]:text-xs [&_h3]:font-medium [&_h3]:text-gray-400 [&_h3]:mt-4 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-brand-400 [&_a:hover]:text-brand-300 [&_strong]:text-gray-400">
        {children}
      </div>
    </section>
  );
}
