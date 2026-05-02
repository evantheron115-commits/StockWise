import { getToken } from 'next-auth/jwt';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return res.status(401).json({ error: 'You must be signed in.' });
  }

  try {
    const r = await fetch(`${API}/api/auth/account`, {
      method:  'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': process.env.INTERNAL_PROXY_SECRET,
      },
      body: JSON.stringify({ userId: token.id }),
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch {
    return res.status(500).json({ error: 'Failed to delete account. Please try again.' });
  }
}
