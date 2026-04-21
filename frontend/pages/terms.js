import Head from 'next/head';
import Link from 'next/link';

const LAST_UPDATED = 'April 21, 2025';

const sections = [
  {
    title: '1. Acceptance of Terms',
    body: `By accessing or using ValuBull ("the Platform", "we", "us", or "our"), you agree to be bound by these Terms of Use. If you do not agree with any part of these terms, you must not use the Platform. We reserve the right to modify these terms at any time; continued use after changes constitutes acceptance.`,
  },
  {
    title: '2. Not Financial Advice',
    body: `All information, data, tools, models, calculations, and content provided by ValuBull — including but not limited to stock prices, financial statements, DCF valuations, key ratios, community posts, and company summaries — are provided for informational and educational purposes only.\n\nNothing on this Platform constitutes financial advice, investment advice, trading advice, or any other type of advice. ValuBull is not a registered investment adviser, broker-dealer, or financial planner. You should not rely on any information on the Platform as a substitute for professional financial advice.`,
  },
  {
    title: '3. Investment Risk Disclosure',
    body: `Investing in financial markets involves significant risk, including the possible loss of principal. Past performance is not indicative of future results. The value of investments may go up or down, and you may receive back less than you invest.\n\nValuBull's analytical tools, including DCF models and ratio analysis, are based on publicly available data and mathematical models that contain inherent assumptions and limitations. These tools do not predict future performance and should not be used as the sole basis for any investment decision.`,
  },
  {
    title: '4. Data Accuracy & Availability',
    body: `Financial data is sourced from third-party providers including Financial Modeling Prep and Polygon.io. While we strive for accuracy, we make no representations or warranties, express or implied, regarding the completeness, accuracy, reliability, or timeliness of any data or content on the Platform.\n\nData may be delayed, incomplete, or subject to errors. ValuBull is not responsible for any inaccuracies in data provided by third-party sources. Always verify data independently before making financial decisions.`,
  },
  {
    title: '5. Limitation of Liability',
    body: `To the maximum extent permitted by applicable law, ValuBull and its owners, operators, employees, agents, and affiliates shall not be liable for any direct, indirect, incidental, special, consequential, or punitive damages, including but not limited to:\n\n• Loss of profits or investment returns\n• Trading losses or missed opportunities\n• Errors in financial calculations or data\n• Service interruptions or data unavailability\n• Reliance on any information provided by the Platform\n\nThis limitation applies regardless of the theory of liability (contract, tort, negligence, or otherwise) and even if ValuBull has been advised of the possibility of such damages.`,
  },
  {
    title: '6. User Conduct',
    body: `You agree to use the Platform only for lawful purposes and in accordance with these Terms. You must not:\n\n• Attempt to scrape, harvest, or systematically extract data from the Platform\n• Use automated bots or scripts to access the Platform without prior written consent\n• Post unlawful, defamatory, abusive, or misleading content in community features\n• Attempt to gain unauthorised access to any part of the Platform or its systems\n• Use the Platform to engage in market manipulation, fraud, or any illegal activity\n• Impersonate any person or entity, or misrepresent your affiliation`,
  },
  {
    title: '7. Community Content',
    body: `The Platform includes a community discussion feature where users may post comments and analysis. User-generated content does not represent the views of ValuBull and is not financial advice. ValuBull reserves the right to remove any content that violates these Terms or applicable law.\n\nBy posting content, you grant ValuBull a non-exclusive, royalty-free, worldwide licence to display, store, and moderate that content. You are solely responsible for content you post and any consequences arising from it.`,
  },
  {
    title: '8. Intellectual Property',
    body: `All Platform content, including design, software, graphics, and text (excluding user-generated content and third-party data), is the property of ValuBull and protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works without express written permission.`,
  },
  {
    title: '9. Privacy',
    body: `Use of the Platform is also governed by our Privacy Policy. By using the Platform, you consent to the collection and use of information as described therein. We collect only the information necessary to provide the service and do not sell personal data to third parties.`,
  },
  {
    title: '10. Third-Party Links & Services',
    body: `The Platform may contain links to third-party websites or services. ValuBull has no control over, and assumes no responsibility for, the content, privacy policies, or practices of any third-party sites. We encourage you to review the terms and privacy policies of any third-party services you access.`,
  },
  {
    title: '11. Termination',
    body: `ValuBull reserves the right to suspend or terminate your access to the Platform at any time, without notice, for conduct that violates these Terms or is harmful to other users, ValuBull, or third parties, or for any other reason at our sole discretion.`,
  },
  {
    title: '12. Governing Law',
    body: `These Terms shall be governed by and construed in accordance with applicable law. Any disputes arising under or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of competent jurisdiction.`,
  },
  {
    title: '13. Changes to These Terms',
    body: `We may update these Terms from time to time. The "Last Updated" date at the top of this page indicates when the most recent revision was made. Continued use of the Platform after any changes constitutes your acceptance of the new Terms.`,
  },
  {
    title: '14. Contact',
    body: `If you have any questions about these Terms of Use, please contact us through the Platform. We will endeavour to respond to all enquiries within a reasonable timeframe.`,
  },
];

export default function TermsOfUse() {
  return (
    <>
      <Head>
        <title>Terms of Use — ValuBull</title>
        <meta name="description" content="ValuBull Terms of Use — important legal information about our financial data platform." />
      </Head>

      <div className="max-w-3xl mx-auto px-4 py-12 print:py-6">

        {/* Header */}
        <div className="mb-10 print:mb-6">
          <Link
            href="/"
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors mb-6 inline-block print:hidden"
          >
            ← Back to ValuBull
          </Link>
          <h1 className="text-2xl font-semibold text-white mb-2">Terms of Use</h1>
          <p className="text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

          {/* Prominent disclaimer box */}
          <div className="mt-6 bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-4">
            <p className="text-sm text-amber-200 font-medium mb-1">
              Not Financial Advice
            </p>
            <p className="text-sm text-amber-100/70 leading-relaxed">
              ValuBull is an informational platform only. Nothing herein constitutes
              financial advice. Always consult a qualified financial professional before
              making investment decisions.
            </p>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-8 print:space-y-6">
          {sections.map(({ title, body }) => (
            <section key={title}>
              <h2 className="text-sm font-semibold text-white mb-2">{title}</h2>
              {body.split('\n\n').map((para, i) => (
                <p key={i} className="text-sm text-gray-400 leading-relaxed mb-2 last:mb-0 whitespace-pre-line">
                  {para}
                </p>
              ))}
              <div className="mt-6 border-b border-white/[0.04]" />
            </section>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-xs text-gray-700 text-center mt-10 print:mt-6">
          © {new Date().getFullYear()} ValuBull. All rights reserved.
        </p>

      </div>
    </>
  );
}
