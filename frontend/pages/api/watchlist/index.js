import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ error: 'You must be signed in.' });

  const headers = {
    'Content-Type': 'application/json',
    'x-api-secret': process.env.NEXTAUTH_SECRET,
  };

  if (req.method === 'GET') {
    try {
      const r    = await fetch(`${API}/api/watchlist?userId=${token.id}`, { headers });
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch {
      return res.status(500).json({ error: 'Failed to load watchlist.' });
    }
  }

  if (req.method === 'POST') {
    const { ticker } = req.body || {};
    try {
      const r = await fetch(`${API}/api/watchlist`, {
        method:  'POST',
        headers,
        body:    JSON.stringify({ userId: token.id, ticker }),
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch {
      return res.status(500).json({ error: 'Failed to add to watchlist.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
