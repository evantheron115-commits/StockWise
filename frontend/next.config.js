// ── Production guard ───────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
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
};

module.exports = nextConfig;
