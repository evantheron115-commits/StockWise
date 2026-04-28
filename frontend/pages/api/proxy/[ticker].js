// Vercel Edge Proxy — direct FMP fallback when Railway is unreachable.
// This runs server-side on Vercel so FMP_API_KEY is never exposed to the client.
//
// Required Vercel environment variable:
//   FMP_API_KEY — set at vercel.com → Project → Settings → Environment Variables
//
// Called automatically by frontend/lib/gateway.js when Railway fails with a
// network error. Transparent to the user — same response shape as the Railway API.

const FMP_BASE = 'https://financialmodelingprep.com/stable';

export default async function handler(req, res) {
  // Only GET — this is a read-only proxy
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ticker } = req.query;
  if (!ticker || !/^[A-Z0-9][A-Z0-9.\-]{0,14}$/i.test(ticker)) {
    return res.status(400).json({ error: 'Invalid ticker' });
  }

  const key = process.env.FMP_API_KEY;
  if (!key) {
    return res.status(503).json({ error: 'Proxy not configured — FMP_API_KEY missing' });
  }

  const sym = ticker.toUpperCase();

  try {
    const [profileRes, quoteRes] = await Promise.all([
      fetch(`${FMP_BASE}/profile?symbol=${sym}&apikey=${key}`, { cache: 'no-store' }),
      fetch(`${FMP_BASE}/quote?symbol=${sym}&apikey=${key}`,   { cache: 'no-store' }),
    ]);

    const profileData = await profileRes.json();
    const quoteData   = await quoteRes.json();

    const p = Array.isArray(profileData) ? profileData[0] : profileData;
    const q = Array.isArray(quoteData)   ? quoteData[0]   : quoteData;

    if (!p?.symbol && !p?.companyName) {
      return res.status(404).json({ error: `"${sym}" not found via proxy` });
    }

    // Build the same shape as the Railway /api/company/:ticker response
    const company = {
      ticker:             (p.symbol || sym).toUpperCase(),
      name:               p.companyName || p.name || sym,
      exchange:           p.exchangeShortName || p.exchange || '',
      sector:             p.sector          || '',
      industry:           p.industry        || '',
      description:        p.description     || '',
      country:            p.country         || '',
      website:            p.website         || '',
      currency:           p.currency        || 'USD',
      employees:          p.fullTimeEmployees ? parseInt(p.fullTimeEmployees) : null,
      price:              q?.price    ?? p.price    ?? null,
      changePercent:      q?.changesPercentage ?? null,
      change:             q?.change   ?? null,
      marketCap:          q?.marketCap ?? p.mktCap  ?? null,
      sharesOutstanding:  q?.sharesOutstanding ?? null,
      beta:               p.beta      ?? null,
      peRatio:            q?.pe       ?? null,
      eps:                q?.eps      ?? null,
      high52w:            q?.yearHigh ?? null,
      low52w:             q?.yearLow  ?? null,
      avgVolume:          q?.avgVolume ?? null,
      _dataSource:        'vercel_proxy',
    };

    // Compute missing metrics inline (same logic as smartFill)
    if (!company.marketCap && company.price > 0 && company.sharesOutstanding > 0)
      company.marketCap = company.price * company.sharesOutstanding;
    if ((!company.peRatio || company.peRatio <= 0) && company.price > 0 && company.eps > 0)
      company.peRatio = +(company.price / company.eps).toFixed(2);

    // Cache at Vercel CDN edge for 60 seconds to absorb repeat requests
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.json({ source: 'proxy', data: company });

  } catch (err) {
    console.error(`[Proxy] ${sym}:`, err.message);
    return res.status(502).json({ error: 'Proxy fetch failed', detail: err.message });
  }
}
