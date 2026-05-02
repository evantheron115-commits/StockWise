const express      = require('express');
const router       = express.Router();
const ctrl         = require('../controllers/authController');
const { verifyAuth } = require('../middleware/auth');

router.post('/register', ctrl.register);
router.post('/login',    ctrl.login);
router.post('/refresh',  ctrl.refresh);   // silent token refresh — no auth middleware
router.post('/oauth',    ctrl.oauthUpsert);

// Accepts: x-api-secret (web proxy) or Authorization: Bearer <jwt> (mobile)
router.delete('/account', verifyAuth, ctrl.deleteAccount);

module.exports = router;
