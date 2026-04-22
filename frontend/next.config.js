// ── Build target ──────────────────────────────────────────────────────────────
// NEXT_BUILD_TARGET controls the output:
//   (unset / "server") → standard Vercel deployment (default)
//   "mobile"           → static export for Capacitor iOS build
//
// To build for Capacitor: NEXT_BUILD_TARGET=mobile npm run build
const isMobileBuild = process.env.NEXT_BUILD_TARGET === 'mobile';

// ── Production guard (only enforced for server builds) ───────────────────────
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

  // Static export for Capacitor — API routes are excluded (mobile calls Railway directly)
  ...(isMobileBuild ? {
    output:   'export',
    images:   { unoptimized: true }, // required for static export
    trailingSlash: true,
  } : {}),
};

module.exports = nextConfig;
