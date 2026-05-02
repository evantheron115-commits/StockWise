import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ error: 'You must be signed in.' });

  const { ticker } = req.query;
  const headers = {
    'Content-Type': 'application/json',
    'x-api-secret': process.env.INTERNAL_PROXY_SECRET,
  };

  if (req.method === 'GET') {
    try {
      const r    = await fetch(`${API}/api/watchlist/${ticker}?userId=${token.id}`, { headers });
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch {
      return res.status(500).json({ error: 'Failed to check watchlist.' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const r = await fetch(`${API}/api/watchlist/${ticker}?userId=${token.id}`, {
        method:  'DELETE',
        headers,
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch {
      return res.status(500).json({ error: 'Failed to remove from watchlist.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
