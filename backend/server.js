require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const companyRoutes = require('./routes/company');
const healthRoutes  = require('./routes/health');
const authRoutes    = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, 'http://localhost:3000']
  : true; // allow all in dev/fallback
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Rate limiting — protect against abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests. Please try again later.' },
});
app.use('/api', limiter);

// Routes
app.use('/api/health',  healthRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/auth',    authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Port binding with automatic fallback ──────────────────────────────────────

const BASE_PORT   = parseInt(PORT);
const MAX_RETRIES = 5;

function startServer(port, attempt = 0) {
  const server = app.listen(port);

  server.on('listening', () => {
    console.log(`\n✅ StockWise backend running on http://localhost:${port}`);
    if (port !== BASE_PORT) {
      console.warn(`⚠️  Started on port ${port} instead of ${BASE_PORT}.`);
      console.warn(`   Update frontend/.env.local → NEXT_PUBLIC_API_URL=http://localhost:${port}`);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (attempt >= MAX_RETRIES) {
        console.error(`❌ Ports ${BASE_PORT}–${BASE_PORT + MAX_RETRIES} are all in use. Free a port and try again.`);
        console.error(`   Run: taskkill /F /IM node.exe`);
        process.exit(1);
      }
      const next = port + 1;
      console.warn(`⚠️  Port ${port} in use — trying ${next}...`);
      server.close();
      startServer(next, attempt + 1);
    } else {
      console.error('❌ Server error:', err.message);
      process.exit(1);
    }
  });
}

startServer(BASE_PORT);

module.exports = app;
