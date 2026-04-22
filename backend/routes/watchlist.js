const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/watchlistController');

router.get('/',           ctrl.getWatchlist);
router.post('/',          ctrl.addToWatchlist);
router.get('/:ticker',    ctrl.checkWatchlist);
router.delete('/:ticker', ctrl.removeFromWatchlist);

module.exports = router;
