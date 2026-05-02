'use strict';
const jwt = require('jsonwebtoken');

// Dual-mode auth middleware — accepts either:
//   1. x-api-secret header (web: Next.js proxy already verified the session)
//      Uses INTERNAL_PROXY_SECRET — a secret shared only between Vercel and Railway.
//      Must NOT be the same value as NEXTAUTH_SECRET (which signs JWTs).
//   2. Authorization: Bearer <jwt> (mobile: Capacitor app calls Railway directly)
//      Verified against NEXTAUTH_SECRET.
//
// After this runs, req.userId and req.userName are guaranteed to be set.
function verifyAuth(req, res, next) {
  // ── Path 1: Web proxy (x-api-secret) ────────────────────────────────────────
  // INTERNAL_PROXY_SECRET is a separate secret from NEXTAUTH_SECRET.
  // Set it in both Railway (backend env) and Vercel (frontend env) with the same value.
  const proxySecret = process.env.INTERNAL_PROXY_SECRET;
  const incoming    = req.headers['x-api-secret'];
  if (proxySecret && incoming && incoming === proxySecret) {
    req.authMode = 'secret';
    return next();
  }

  // ── Path 2: Mobile Bearer JWT (Capacitor → Railway direct) ──────────────────
  const auth = req.headers['authorization'];
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET);
      // Reject refresh tokens used as access tokens
      if (decoded.type === 'refresh') {
        return res.status(401).json({ error: 'Invalid token type.' });
      }
      req.userId   = decoded.id;
      req.userName = decoded.name || decoded.email;
      req.authMode = 'jwt';
      return next();
    } catch {
      return res.status(401).json({ error: 'Token expired or invalid. Please sign in again.' });
    }
  }

  return res.status(401).json({ error: 'Unauthorized.' });
}

module.exports = { verifyAuth };
