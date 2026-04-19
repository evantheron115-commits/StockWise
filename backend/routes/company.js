const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/company');

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

module.exports = router;
