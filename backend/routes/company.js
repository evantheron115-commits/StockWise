const express   = require('express');
const router    = express.Router();
const ctrl      = require('../controllers/company');
const predictor = require('../services/predictor');

const TICKER_RE = /^[A-Z0-9][A-Z0-9.\-]{0,14}$/i;

// Predictive pre-warm — fires when user lands on a ticker page.
// Immediately returns the related tickers being warmed; warming runs in background.
router.post('/predictive-warm', (req, res) => {
  const ticker = (req.body?.ticker || '').toUpperCase().trim();
  if (!TICKER_RE.test(ticker)) return res.status(400).json({ error: 'Invalid ticker' });
  const related = predictor.getRelated(ticker);
  predictor.warmRelated(ticker).catch(() => {});
  return res.json({ warming: related });
});

// Search
router.get('/search', ctrl.searchCompanies);

// Company overview
router.get('/:ticker', ctrl.getCompany);

// Financial statements (income, balance, cashflow)
router.get('/:ticker/financials', ctrl.getFinancials);

// Latest news articles
router.get('/:ticker/news', ctrl.getNews);

// Price chart data
router.get('/:ticker/chart', ctrl.getChart);

// DCF valuation engine
router.post('/:ticker/dcf', ctrl.runDCF);

// Full-spectrum: company + financials + 1Y chart in one parallel burst
router.get('/:ticker/full-spectrum', ctrl.getFullSpectrum);

module.exports = router;
