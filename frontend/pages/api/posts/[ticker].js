import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default async function handler(req, res) {
  const { ticker } = req.query;

  if (req.method === 'GET') {
    try {
      const r    = await fetch(`${API}/api/posts/${ticker}`);
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch {
      return res.status(500).json({ error: 'Failed to load posts.' });
    }
  }

  if (req.method === 'POST') {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return res.status(401).json({ error: 'You must be signed in to post.' });
    }

    const { content } = req.body || {};
    try {
      const r = await fetch(`${API}/api/posts/${ticker}`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-secret': process.env.INTERNAL_PROXY_SECRET,
        },
        body: JSON.stringify({
          content,
          userId:   token.id,
          userName: token.name || token.email,
        }),
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    } catch {
      return res.status(500).json({ error: 'Failed to post.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
