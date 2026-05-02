'use strict';
const express        = require('express');
const router         = express.Router();
const ctrl           = require('../controllers/push');
const { verifyAuth } = require('../middleware/auth');

router.post('/register',   verifyAuth, ctrl.registerDevice);
router.delete('/unregister', verifyAuth, ctrl.unregisterDevice);

module.exports = router;
