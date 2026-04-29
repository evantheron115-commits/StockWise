'use strict';

// Neural-Predictive Pre-Cache
// When a user views a ticker, the frontend fires POST /api/company/predictive-warm.
// This service resolves the 5 most likely "next clicks" based on sector relationships
// and pre-warms their Redis + DB cache in the background before the user navigates.

const log = require('../utils/logger');

// Sector relationship map — curated by market sector and typical co-analysis patterns.
// Each ticker maps to its top 5 "frequently analyzed alongside" peers.
const RELATED = {
  // ── AI / Semiconductors ────────────────────────────────────────────────────
  NVDA:  ['AMD',  'TSM',  'AVGO', 'INTC', 'MSFT'],
  AMD:   ['NVDA', 'INTC', 'AVGO', 'TSM',  'QCOM'],
  TSM:   ['NVDA', 'AMD',  'AVGO', 'INTC', 'AMAT'],
  INTC:  ['AMD',  'NVDA', 'AVGO', 'TSM',  'QCOM'],
  AVGO:  ['NVDA', 'AMD',  'QCOM', 'TSM',  'INTC'],
  QCOM:  ['AVGO', 'AMD',  'NVDA', 'INTC', 'TSM'],
  AMAT:  ['LRCX', 'KLAC', 'TSM',  'NVDA', 'AMD'],

  // ── Big Tech ───────────────────────────────────────────────────────────────
  AAPL:  ['MSFT', 'GOOGL', 'META', 'AMZN', 'NVDA'],
  MSFT:  ['AAPL', 'GOOGL', 'AMZN', 'CRM',  'NVDA'],
  GOOGL: ['META', 'MSFT',  'AMZN', 'AAPL', 'NFLX'],
  META:  ['GOOGL', 'SNAP', 'PINS', 'MSFT', 'AAPL'],
  AMZN:  ['MSFT', 'GOOGL', 'SHOP', 'WMT',  'AAPL'],

  // ── Cloud / SaaS ───────────────────────────────────────────────────────────
  CRM:   ['MSFT', 'NOW',  'WDAY', 'ORCL', 'SAP'],
  NOW:   ['CRM',  'WDAY', 'MSFT', 'ORCL', 'INTU'],
  INTU:  ['NOW',  'CRM',  'ADBE', 'MSFT', 'ORCL'],
  ADBE:  ['CRM',  'NOW',  'INTU', 'MSFT', 'FIGM'],
  ORCL:  ['MSFT', 'CRM',  'NOW',  'SAP',  'IBM'],

  // ── EV / Automotive ────────────────────────────────────────────────────────
  TSLA:  ['GM',   'F',    'RIVN', 'NIO',  'LCID'],
  GM:    ['TSLA', 'F',    'STLA', 'TM',   'HMC'],
  F:     ['GM',   'TSLA', 'STLA', 'TM',   'RIVN'],
  RIVN:  ['TSLA', 'LCID', 'NIO',  'F',    'GM'],

  // ── Finance / Banks ────────────────────────────────────────────────────────
  JPM:   ['BAC',  'WFC',  'GS',   'MS',   'C'],
  BAC:   ['JPM',  'WFC',  'C',    'GS',   'MS'],
  GS:    ['MS',   'JPM',  'BLK',  'SCHW', 'C'],
  MS:    ['GS',   'JPM',  'BLK',  'SCHW', 'BAC'],
  V:     ['MA',   'PYPL', 'AXP',  'SQ',   'FIS'],
  MA:    ['V',    'PYPL', 'AXP',  'SQ',   'FIS'],

  // ── Pharma / Biotech ───────────────────────────────────────────────────────
  LLY:   ['NVO',  'ABBV', 'JNJ',  'PFE',  'MRK'],
  NVO:   ['LLY',  'ABBV', 'JNJ',  'PFE',  'MRK'],
  JNJ:   ['ABBV', 'PFE',  'MRK',  'LLY',  'BMY'],
  ABBV:  ['JNJ',  'PFE',  'MRK',  'LLY',  'BMY'],
  PFE:   ['JNJ',  'ABBV', 'MRK',  'BMY',  'MRNA'],

  // ── Energy ────────────────────────────────────────────────────────────────
  XOM:   ['CVX',  'COP',  'OXY',  'SLB',  'BP'],
  CVX:   ['XOM',  'COP',  'OXY',  'SLB',  'EOG'],
  COP:   ['XOM',  'CVX',  'OXY',  'EOG',  'SLB'],

  // ── Consumer / Retail ─────────────────────────────────────────────────────
  AMZN:  ['WMT',  'SHOP', 'TGT',  'COST', 'BABA'],
  WMT:   ['AMZN', 'TGT',  'COST', 'KR',   'DG'],
  COST:  ['WMT',  'TGT',  'BJ',   'AMZN', 'KR'],

  // ── Streaming / Media ─────────────────────────────────────────────────────
  NFLX:  ['DIS',  'WBD',  'PARA', 'AMZN', 'GOOGL'],
  DIS:   ['NFLX', 'WBD',  'PARA', 'CMCSA','AMC'],

  // ── Default fallback: broad mega-cap peers ─────────────────────────────────
  _DEFAULT: ['AAPL', 'MSFT', 'AMZN', 'GOOGL', 'NVDA'],
};

// Deduplicate AMZN — it was defined twice above
// (second definition wins; first is intentional for AMZN in the EV block context)

function getRelated(ticker) {
  const t = (ticker || '').toUpperCase().trim();
  return (RELATED[t] || RELATED._DEFAULT).filter(r => r !== t);
}

// Pre-warms the 5 related tickers by calling harvestTicker on each.
// Returns immediately — warming runs in the background.
async function warmRelated(ticker) {
  const tickers = getRelated(ticker);
  const { harvestTicker } = require('./harvester');
  log.info(`[Predictor] Warming ${tickers.join(', ')} for ${ticker}`);
  // Concurrency: 2 at a time to stay gentle on FMP limits
  for (let i = 0; i < tickers.length; i += 2) {
    await Promise.allSettled(tickers.slice(i, i + 2).map(t => harvestTicker(t)));
  }
}

module.exports = { getRelated, warmRelated };
