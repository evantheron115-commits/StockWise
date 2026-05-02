const isMobileBuild = process.env.NEXT_BUILD_TARGET === 'mobile';

// Build-time guard — aborts the Vercel build if the API URL is missing or wrong.
// Not enforced for mobile builds because next.config.js runs on the CI machine,
// not in the Capacitor WebView.
if (process.env.NODE_ENV === 'production' && !isMobileBuild) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl || apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
    throw new Error(
      '\n\n[ValuBull] Build aborted: NEXT_PUBLIC_API_URL is missing or points to localhost.\n' +
      'Add it in Vercel → Settings → Environment Variables.\n'
    );
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

  // Expose build target to browser code so components can choose
  // relative paths (Vercel edge) vs. full Railway URL (Capacitor).
  env: {
    NEXT_PUBLIC_BUILD_TARGET: process.env.NEXT_BUILD_TARGET || 'web',
  },

  experimental: {
    scrollRestoration: true,
  },

  // SWC strips all console.log/warn/info from the mobile bundle at compile time.
  // console.error is preserved — it surfaces genuine runtime failures.
  // On web builds this is left off so developers keep their logs during local work.
  compiler: {
    removeConsole: isMobileBuild ? { exclude: ['error'] } : false,
  },

  // Whitelist external image domains for next/image optimization
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'financialmodelingprep.com' },
    ],
  },

  // Long-lived cache headers for all public static assets
  async headers() {
    return [
      {
        source: '/icons/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/images/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:file(.*\\.(?:ico|png|svg|webp|woff2?))',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Cache the logo proxy at Vercel's edge for 30 days.
      // s-maxage instructs CDN/Edge nodes; stale-while-revalidate serves
      // the cached copy while a fresh fetch happens in the background.
      {
        source: '/logo/:ticker',
        headers: [{
          key: 'Cache-Control',
          value: 'public, s-maxage=2592000, stale-while-revalidate=86400, immutable',
        }],
      },
      // Next.js HTML pages: serve from Vercel CDN for 1 day; revalidate quietly.
      // The dynamic stock data itself is fetched client-side from Railway — this
      // only caches the HTML shell so the initial paint is instant at the edge.
      {
        source: '/(.*)',
        headers: [{
          key: 'Cache-Control',
          value: 'public, s-maxage=86400, stale-while-revalidate=86400',
        }],
      },
    ];
  },

  // Rewrite /logo/:ticker through Next.js so Vercel's edge CDN sits in front
  // of the Railway logo proxy, enabling 30-day edge caching for all logos.
  async rewrites() {
    if (isMobileBuild) return [];
    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    if (!apiBase) return [];
    return [
      {
        source:      '/logo/:ticker',
        destination: `${apiBase}/api/company/logo/:ticker`,
      },
    ];
  },

  // Static export for Capacitor — API routes are excluded (mobile calls Railway directly)
  ...(isMobileBuild ? {
    output:        'export',
    images:        { unoptimized: true },
    trailingSlash: true,
  } : {}),
};

module.exports = nextConfig;
