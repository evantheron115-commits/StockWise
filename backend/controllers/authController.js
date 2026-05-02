'use strict';
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../db/queries');

// POST /api/auth/register
async function register(req, res) {
  const { email, name, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const existing = await db.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user   = await db.createUser({ email, name: name?.trim() || null, password: hashed });

    return res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error('[register]', err.message);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
}

// POST /api/auth/login  — called by NextAuth Credentials provider
async function login(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = await db.getUserByEmail(email);
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Access token — 30-day lifetime, stored in @capacitor/preferences on native
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
      process.env.NEXTAUTH_SECRET,
      { expiresIn: '30d' }
    );

    // Refresh token — 90-day lifetime, type claim prevents use as access token
    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      process.env.NEXTAUTH_SECRET,
      { expiresIn: '90d' }
    );

    return res.json({
      user:         { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
      token,        // access token — short-lived API credential
      refreshToken, // refresh token — only valid against /api/auth/refresh
    });
  } catch (err) {
    console.error('[login]', err.message);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
}

// POST /api/auth/oauth  — called by NextAuth signIn callback for Google/Apple
async function oauthUpsert(req, res) {
  const { email, name, avatar, provider } = req.body || {};
  if (!email || !provider) {
    return res.status(400).json({ error: 'email and provider are required.' });
  }

  try {
    const user = await db.upsertOAuthUser({ email, name, avatar, provider });
    return res.json({ user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar } });
  } catch (err) {
    console.error('[oauthUpsert]', err.message);
    return res.status(500).json({ error: 'OAuth sign-in failed.' });
  }
}

// DELETE /api/auth/account — hard-delete the authenticated user's account
// Works from both web proxy (x-api-secret + body.userId) and mobile (Bearer JWT)
async function deleteAccount(req, res) {
  // JWT path: userId was extracted by verifyAuth middleware
  // Secret path: userId forwarded in request body by Next.js proxy
  const userId = req.userId ?? req.body?.userId;
  if (!userId) return res.status(400).json({ error: 'userId required.' });

  try {
    await db.deleteUserAccount(parseInt(userId, 10));
    return res.json({ deleted: true });
  } catch (err) {
    console.error('[deleteAccount]', err.message);
    return res.status(500).json({ error: 'Failed to delete account. Please try again.' });
  }
}

// POST /api/auth/refresh — exchange a valid refresh token for a new access token.
// Refresh tokens have { type: 'refresh' } claim; access tokens do not.
// This design prevents access tokens from being used as refresh tokens and vice versa.
async function refresh(req, res) {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required.' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.NEXTAUTH_SECRET);
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type.' });
    }

    const user = await db.getUserById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found.' });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
      process.env.NEXTAUTH_SECRET,
      { expiresIn: '30d' }
    );

    return res.json({ token });
  } catch {
    return res.status(401).json({ error: 'Refresh token expired or invalid. Please sign in again.' });
  }
}

module.exports = { register, login, refresh, oauthUpsert, deleteAccount };
