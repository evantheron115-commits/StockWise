'use strict';

// Real-Time Price Engine
// Socket.io server that pushes live price updates to subscribed clients.
// Clients emit "subscribe"/"unsubscribe" with a ticker string.
// Backend polls FMP for all active subscriptions every 20s and broadcasts
// "price:update" events to the relevant rooms.

const { Server } = require('socket.io');
const axios      = require('axios');

const POLL_MS    = 20 * 1000;  // Poll FMP every 20 seconds
const FMP_BASE   = 'https://financialmodelingprep.com/stable';
const TICKER_RE  = /^[A-Z0-9][A-Z0-9.\-]{0,14}$/i;

// ticker → Set of socket IDs currently subscribed
const subscriptions = new Map();
let io = null;

async function broadcastPrices() {
  const active = [...subscriptions.entries()]
    .filter(([, subs]) => subs.size > 0)
    .map(([ticker]) => ticker);

  if (!active.length) return;

  // Fetch in parallel chunks of 10 — one FMP request per ticker (stable API)
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
        price:         q.price          ?? null,
        change:        q.change         ?? null,
        changePercent: q.changesPercentage ?? null,
        volume:        q.volume         ?? null,
        ts:            Date.now(),
      });
    }
  }
}

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
    transports: ['websocket', 'polling'],
    pingTimeout:  60_000,
    pingInterval: 25_000,
  });

  io.on('connection', (socket) => {
    console.log(`[Sockets] connect  ${socket.id}`);

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
      for (const subs of subscriptions.values()) {
        subs.delete(socket.id);
      }
      console.log(`[Sockets] disconnect ${socket.id}`);
    });
  });

  // Price broadcast loop — only fires when clients are subscribed
  setInterval(() => {
    broadcastPrices().catch(err => {
      if (!err.isRateLimit) console.warn('[Sockets] Broadcast error:', err.message);
    });
  }, POLL_MS);

  console.log('[Sockets] Socket.io initialized — price broadcast every 20s');
  return io;
}

module.exports = { init };
