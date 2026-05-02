require('dotenv').config();

// Sentry error tracking — initialise before anything else so uncaught
// exceptions and unhandled rejections are captured from startup.
// No-op if SENTRY_DSN is absent so local/staging builds are unaffected.
let Sentry = null;
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn:              process.env.SENTRY_DSN,
      environment:      process.env.NODE_ENV || 'production',
      tracesSampleRate: 0.05, // 5 % of requests traced — keeps quota free
    });
    console.log('[Sentry] Initialised');
  } catch (e) {
    console.warn('[Sentry] Init failed — continuing without error tracking:', e.message);
    Sentry = null;
  }
}

// Fail fast if critical env vars are missing
const REQUIRED_ENV = ['DATABASE_URL', 'FMP_API_KEY'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[Startup] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const http      = require('http');
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const companyRoutes   = require('./routes/company');
const healthRoutes    = require('./routes/health');
const authRoutes      = require('./routes/auth');
const postsRoutes     = require('./routes/posts');
const watchlistRoutes = require('./routes/watchlist');
const pushRoutes      = require('./routes/push');
const autoMigrate     = require('./db/autoMigrate');
const heartbeat       = require('./services/heartbeat');
const harvester       = require('./services/harvester');
const sockets         = require('./utils/sockets');

const app  = express();
const PORT = process.env.PORT || 4000;

// Trust Railway/Vercel reverse proxy so rate-limiter reads the real client IP
app.set('trust proxy', 1);

// Security headers — prevents clickjacking, MIME sniffing, XSS, etc.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // CSP handled by Next.js frontend
}));

// Middleware
function corsOrigin(origin, callback) {
  const allowed = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3001',
    'capacitor://localhost',  // iOS Capacitor app
    'http://localhost',       // Android Capacitor app
  ].filter(Boolean);
  // Allow requests with no origin (server-to-server, curl, health checks)
  // Vercel wildcard removed — only the explicit FRONTEND_URL is trusted
  if (!origin || allowed.includes(origin)) {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'));
  }
}
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '16kb' })); // Reject oversized request bodies

// Rate limiting — protect against abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
app.use('/api', limiter);

// Strict rate limit for auth endpoints — prevents brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts. Please wait 15 minutes and try again.' },
});

// Sentry request handler — must be before routes
if (Sentry) app.use(Sentry.requestHandler());

// Routes
app.use('/api/health',    healthRoutes);
app.use('/health',        healthRoutes); // alias for older builds
app.use('/api/company',   companyRoutes);
app.use('/api/auth',      authLimiter, authRoutes);
app.use('/api/posts',     postsRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/push',      pushRoutes);

// Sentry error handler — must be before the 404 and global error handlers
if (Sentry) app.use(Sentry.expressErrorHandler());

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── HTTP server + Socket.io ───────────────────────────────────────────────────

const httpServer = http.createServer(app);
sockets.init(httpServer);

// ── Port binding with automatic fallback ─────────────────────────────────────

const BASE_PORT   = parseInt(PORT);
const MAX_RETRIES = 5;

function startServer(port, attempt = 0) {
  httpServer.listen(port);

  httpServer.once('listening', () => {
    console.log(`\n✅ ValuBull backend running on http://localhost:${port}`);
    if (port !== BASE_PORT) {
      console.warn(`⚠️  Started on port ${port} instead of ${BASE_PORT}.`);
      console.warn(`   Update frontend/.env.local → NEXT_PUBLIC_API_URL=http://localhost:${port}`);
    }
    heartbeat.start(port);
    harvester.start();
  });

  httpServer.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (attempt >= MAX_RETRIES) {
        console.error(`❌ Ports ${BASE_PORT}–${BASE_PORT + MAX_RETRIES} are all in use. Free a port and try again.`);
        console.error(`   Run: taskkill /F /IM node.exe`);
        process.exit(1);
      }
      const next = port + 1;
      console.warn(`⚠️  Port ${port} in use — trying ${next}...`);
      httpServer.close(() => startServer(next, attempt + 1));
    } else {
      console.error('❌ Server error:', err.message);
      process.exit(1);
    }
  });
}

autoMigrate().then(() => startServer(BASE_PORT));

module.exports = app;
