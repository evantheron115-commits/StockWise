const path = require('path');

// ── Production guard ───────────────────────────────────────────────────────────
// Fail the Vercel/CI build immediately if NEXT_PUBLIC_API_URL is missing or
// still points at localhost. Fix: Vercel → Settings → Environment Variables →
//   NEXT_PUBLIC_API_URL = https://your-backend.up.railway.app
if (process.env.NODE_ENV === 'production') {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl || apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
    throw new Error(
      '\n\n[ValuBull] Build aborted: NEXT_PUBLIC_API_URL is missing or points to localhost.\n' +
      'Add it in Vercel → Settings → Environment Variables:\n' +
      '  NEXT_PUBLIC_API_URL = https://your-backend.up.railway.app\n' +
      'Then trigger a new deployment.\n'
    );
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  outputFileTracingRoot: path.resolve(__dirname),
};

module.exports = nextConfig;
