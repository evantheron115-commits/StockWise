'use strict';
const db = require('../db/queries');

const TICKER_RE = /^[A-Z0-9.^-]{1,20}$/i;

function requireSecret(req, res) {
  const secret = req.headers['x-api-secret'];
  if (!secret || secret !== process.env.NEXTAUTH_SECRET) {
    res.status(401).json({ error: 'Unauthorized.' });
    return false;
  }
  return true;
}

async function getWatchlist(req, res) {
  if (!requireSecret(req, res)) return;
  const userId = parseInt(req.query.userId, 10);
  if (!userId) return res.status(400).json({ error: 'userId required.' });

  try {
    const items = await db.getWatchlist(userId);
    res.json({ watchlist: items });
  } catch (err) {
    console.error('[getWatchlist]', err.message);
    res.status(500).json({ error: 'Failed to load watchlist.' });
  }
}

async function addToWatchlist(req, res) {
  if (!requireSecret(req, res)) return;
  const { userId, ticker } = req.body || {};

  if (!userId || !ticker) {
    return res.status(400).json({ error: 'userId and ticker are required.' });
  }
  if (!TICKER_RE.test(ticker)) {
    return res.status(400).json({ error: 'Invalid ticker symbol.' });
  }

  try {
    const item = await db.addToWatchlist(parseInt(userId, 10), ticker);
    res.status(201).json({ item: item || { ticker: ticker.toUpperCase(), alreadyAdded: true } });
  } catch (err) {
    console.error('[addToWatchlist]', err.message);
    res.status(500).json({ error: 'Failed to add to watchlist.' });
  }
}

async function removeFromWatchlist(req, res) {
  if (!requireSecret(req, res)) return;
  const ticker  = req.params.ticker?.toUpperCase();
  const userId  = parseInt(req.query.userId, 10);

  if (!userId) return res.status(400).json({ error: 'userId required.' });
  if (!TICKER_RE.test(ticker)) return res.status(400).json({ error: 'Invalid ticker symbol.' });

  try {
    const removed = await db.removeFromWatchlist(userId, ticker);
    res.json({ removed });
  } catch (err) {
    console.error('[removeFromWatchlist]', err.message);
    res.status(500).json({ error: 'Failed to remove from watchlist.' });
  }
}

async function checkWatchlist(req, res) {
  if (!requireSecret(req, res)) return;
  const ticker  = req.params.ticker?.toUpperCase();
  const userId  = parseInt(req.query.userId, 10);

  if (!userId) return res.status(400).json({ error: 'userId required.' });
  if (!TICKER_RE.test(ticker)) return res.status(400).json({ error: 'Invalid ticker symbol.' });

  try {
    const inWatchlist = await db.isInWatchlist(userId, ticker);
    res.json({ inWatchlist });
  } catch (err) {
    console.error('[checkWatchlist]', err.message);
    res.status(500).json({ error: 'Failed to check watchlist.' });
  }
}

module.exports = { getWatchlist, addToWatchlist, removeFromWatchlist, checkWatchlist };
