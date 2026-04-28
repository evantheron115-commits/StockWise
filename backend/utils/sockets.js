'use strict';

// Real-Time Price Engine + Vanta-Glass Company Push
// Socket.io server — two event types:
//   price:update   — emitted every 20s from the FMP poll loop
//   company:update — emitted by the harvester whenever it refreshes a ticker

const { Server } = require('socket.io');
const axios  = require('axios');
const log    = require('./logger');

const POLL_MS   = 20 * 1000;
const FMP_BASE  = 'https://financialmodelingprep.com/stable';
const TICKER_RE = /^[A-Z0-9][A-Z0-9.\-]{0,14}$/i;

const subscriptions = new Map(); // ticker → Set<socketId>
let io = null;

// ── Price broadcast loop ──────────────────────────────────────────────────────

async function broadcastPrices() {
  const active = [...subscriptions.entries()]
    .filter(([, subs]) => subs.size > 0)
    .map(([ticker]) => ticker);
  if (!active.length) return;

  const CHUNK = 10;
  for (let i = 0; i < active.length; i += CHUNK) {
    const chunk = active.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map(t =>
        axios.get(`${FMP_BASE}/quote?symbol=${encodeURIComponent(t)}&apikey=${process.env.FMP_API_KEY}`, {
          timeout: 8000,
        })
          .then(r => (Array.isArray(r.data) ? r.data[0] : r.data))
          .catch(() => null)
      )
    );
    for (const q of results) {
      if (!q?.symbol) continue;
      const ticker = q.symbol.toUpperCase();
      if (!subscriptions.get(ticker)?.size) continue;
      io.to(`ticker:${ticker}`).emit('price:update', {
        ticker,
        price:         q.price             ?? null,
        change:        q.change            ?? null,
        changePercent: q.changesPercentage ?? null,
        volume:        q.volume            ?? null,
        ts:            Date.now(),
      });
    }
  }
}

// ── Vanta-Glass: push harvester company refresh to active viewers ─────────────

function pushCompanyUpdate(ticker, company) {
  if (!io) return;
  io.to(`ticker:${ticker.toUpperCase()}`).emit('company:update', {
    ticker:  ticker.toUpperCase(),
    company,
    ts:      Date.now(),
  });
}

// ── Server init ───────────────────────────────────────────────────────────────

function init(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin(origin, cb) {
        const allowed = [
          process.env.FRONTEND_URL,
          'http://localhost:3000',
          'http://localhost:3001',
        ].filter(Boolean);
        if (!origin || allowed.includes(origin) || /\.vercel\.app$/.test(origin)) {
          cb(null, true);
        } else {
          cb(new Error('WebSocket origin not allowed'));
        }
      },
      credentials: true,
    },
    transports:   ['websocket', 'polling'],
    pingTimeout:  60_000,
    pingInterval: 25_000,
  });

  io.on('connection', (socket) => {
    log.info(`[Sockets] connect ${socket.id}`);

    socket.on('subscribe', (ticker) => {
      if (typeof ticker !== 'string' || !TICKER_RE.test(ticker)) return;
      const t = ticker.toUpperCase();
      socket.join(`ticker:${t}`);
      if (!subscriptions.has(t)) subscriptions.set(t, new Set());
      subscriptions.get(t).add(socket.id);
    });

    socket.on('unsubscribe', (ticker) => {
      if (typeof ticker !== 'string') return;
      const t = ticker.toUpperCase();
      socket.leave(`ticker:${t}`);
      subscriptions.get(t)?.delete(socket.id);
    });

    socket.on('disconnect', () => {
      for (const subs of subscriptions.values()) subs.delete(socket.id);
      log.info(`[Sockets] disconnect ${socket.id}`);
    });
  });

  setInterval(() => {
    broadcastPrices().catch(err => {
      if (!err?.isRateLimit) log.warn('[Sockets] Broadcast error', { err: err.message });
    });
  }, POLL_MS);

  log.info('[Sockets] Socket.io initialized — price broadcast every 20s');
  return io;
}

module.exports = { init, pushCompanyUpdate };
