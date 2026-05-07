'use strict';
// Price Alert Sentinel — runs every 5 minutes, checks all pending alerts,
// triggers push notifications when a price condition is met.
// Uses marketData.fetchQuote (Finnhub first) so this costs zero FMP credits.

const marketData = require('./marketData');
const pushSender = require('./pushSender');
const db         = require('../db/queries');
const log        = require('../utils/logger');
const { getCache, setCache } = require('../utils/cache');

const INTERVAL_MS  = 5 * 60 * 1000; // 5 minutes
const DEDUP_TTL    = 3600;           // don't re-trigger the same alert within 1 hour

async function checkAlerts() {
  const alerts = await db.getPendingAlerts().catch(() => []);
  if (!alerts.length) return;

  // Group by ticker — one quote fetch per ticker regardless of how many alerts
  const byTicker = new Map();
  for (const a of alerts) {
    if (!byTicker.has(a.ticker)) byTicker.set(a.ticker, []);
    byTicker.get(a.ticker).push(a);
  }

  let triggered = 0;
  for (const [ticker, tickerAlerts] of byTicker) {
    try {
      const quote = await marketData.fetchQuote(ticker).catch(() => null);
      if (!quote?.price) continue;

      const price = parseFloat(quote.price);

      for (const alert of tickerAlerts) {
        const target = parseFloat(alert.target_price);
        const hit =
          (alert.condition === 'above' && price >= target) ||
          (alert.condition === 'below' && price <= target);
        if (!hit) continue;

        // Deduplicate — Redis key ensures we don't spam the same alert
        const dedupeKey = `alert:fired:${alert.id}`;
        const alreadyFired = await getCache(dedupeKey).catch(() => null);
        if (alreadyFired) continue;

        await db.triggerAlert(alert.id);
        await setCache(dedupeKey, 1, DEDUP_TTL);
        triggered++;

        const arrow   = alert.condition === 'above' ? '↑' : '↓';
        const target  = parseFloat(alert.target_price).toFixed(2);
        const devices = await db.getPushDevicesByUser(alert.user_id).catch(() => []);
        if (devices.length) {
          const tokens  = devices.map((d) => d.device_token);
          const results = await pushSender.sendMulti(tokens, {
            title: `${ticker} Alert Triggered`,
            body:  `${ticker} is now $${price.toFixed(2)} ${arrow} your $${target} target`,
            data:  { ticker, type: 'price_alert', url: `/stock/${ticker}` },
          }).catch(() => []);
          for (const r of results) {
            if (r.shouldDeleteToken) {
              await db.removePushDevice(alert.user_id, r.token).catch(() => {});
            }
          }
        }
      }
    } catch (err) {
      log.warn(`[AlertSentinel] Error on ${ticker}: ${err.message}`);
    }
  }

  if (triggered > 0) {
    log.info(`[AlertSentinel] ${triggered} alert(s) triggered`);
  }
}

function start() {
  // Stagger first run by 60s so startup traffic settles first
  setTimeout(() => {
    checkAlerts().catch(() => {});
    setInterval(() => checkAlerts().catch(() => {}), INTERVAL_MS);
  }, 60_000);

  log.info('[AlertSentinel] Price alert sentinel started — checks every 5 minutes');
}

module.exports = { start };
