'use strict';
const jwt = require('jsonwebtoken');

// Dual-mode auth middleware — accepts either:
//   1. x-api-secret header (web: Next.js proxy already verified the session)
//   2. Authorization: Bearer <jwt> (mobile: Capacitor app calls Railway directly)
//
// After this runs, req.userId and req.userName are guaranteed to be set.
function verifyAuth(req, res, next) {
  // ── Path 1: Web proxy (x-api-secret) ────────────────────────────────────────
  const secret = req.headers['x-api-secret'];
  if (secret && secret === process.env.NEXTAUTH_SECRET) {
    // userId is forwarded in the request body or query by the Next.js proxy
    req.authMode = 'secret';
    return next();
  }

  // ── Path 2: Mobile Bearer JWT (Capacitor → Railway direct) ──────────────────
  const auth = req.headers['authorization'];
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      const decoded  = jwt.verify(token, process.env.NEXTAUTH_SECRET);
      req.userId     = decoded.id;
      req.userName   = decoded.name || decoded.email;
      req.authMode   = 'jwt';
      return next();
    } catch {
      return res.status(401).json({ error: 'Token expired or invalid. Please sign in again.' });
    }
  }

  return res.status(401).json({ error: 'Unauthorized.' });
}

module.exports = { verifyAuth };
